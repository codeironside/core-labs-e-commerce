import { createAdapter } from '@socket.io/redis-adapter';
import { Server, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';
import { redisClient } from '../cache/index.js';
import { LivestreamParticipant, LivestreamSession } from '../../../API/LIVESTREAMS/models/index.js';
import { registerLivestreamSocketEmitter } from '../livestreamBroadcast/index.js';
import { broadcastLivestreamEvent } from '../livestreamBroadcast/index.js';

type TokenPayload = {
  userId: string;
  workspaceId: string;
  role: string;
};

let ioInstance: Server | null = null;

const authenticateSocket = (socket: Socket, next: (error?: Error) => void): void => {
  const token =
    socket.handshake.auth?.token
    ?? (typeof socket.handshake.headers.authorization === 'string'
      ? socket.handshake.headers.authorization.replace('Bearer ', '')
      : undefined);

  const guestAuth = typeof socket.handshake.auth?.guestViewerId === 'string'
    ? socket.handshake.auth.guestViewerId.trim()
    : undefined;
  const guestHeader = typeof socket.handshake.headers['x-guest-viewer-id'] === 'string'
    ? socket.handshake.headers['x-guest-viewer-id'].trim()
    : undefined;
  const guestKey = guestAuth ?? guestHeader;

  if (!token) {
    socket.data.userId = guestKey ? `guest_${guestKey}` : `guest_${socket.id}`;
    socket.data.isGuest = true;
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, config.app.JWT_ACCESS_SECRET) as TokenPayload;
    socket.data.userId = payload.userId;
    socket.data.workspaceId = payload.workspaceId;
    socket.data.role = payload.role;
    socket.data.isGuest = false;
    next();
  } catch {
    socket.data.userId = guestKey ? `guest_${guestKey}` : `guest_${socket.id}`;
    socket.data.isGuest = true;
    next();
  }
};

const emitPresence = (
  livestreamId: string,
  payload: {
    userId: string;
    isGuest: boolean;
    joinedAt: string;
    sharingCamera?: boolean;
  },
): void => {
  ioInstance?.to(`livestream:${livestreamId}`).emit('livestream:presence', {
    type: 'viewer.joined',
    livestreamId,
    ...payload,
  });
};

const broadcastViewerCount = async (livestreamId: string, room: string): Promise<void> => {
  const roomSockets = await ioInstance!.in(room).fetchSockets();
  const viewerCount = roomSockets.length;
  await broadcastLivestreamEvent(livestreamId, { type: 'viewer.count', livestreamId, viewerCount });
};

export const emitToLivestreamRoom = (
  livestreamId: string,
  event: string,
  payload: Record<string, unknown>,
): void => {
  ioInstance?.to(`livestream:${livestreamId}`).emit(event, payload);
};

export const emitToChatRoom = (
  conversationId: string,
  event: string,
  payload: Record<string, unknown>,
): void => {
  ioInstance?.to(`chat:${conversationId}`).emit(event, payload);
};

export const initLivestreamSocket = async (httpServer: HttpServer): Promise<Server> => {
  ioInstance = new Server(httpServer, {
    path: '/commerce/socket.io',
    cors: { origin: config.app.corsOrigin, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  try {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    ioInstance.adapter(createAdapter(pubClient, subClient));
    logger.info('Livestream socket Redis adapter enabled');
  } catch (error) {
    logger.warn(
      { error },
      'Livestream socket Redis adapter unavailable; using in-memory adapter',
    );
  }

  registerLivestreamSocketEmitter(emitToLivestreamRoom);

  ioInstance.use(authenticateSocket);

  ioInstance.on('connection', (socket: Socket) => {
    const userId = String(socket.data.userId ?? '');

    socket.on('livestream:join', async (payload: { livestreamId?: string }) => {
      const livestreamId = payload?.livestreamId;
      if (!livestreamId) return;

      const livestream = await LivestreamSession.findById(livestreamId).select('_id status endedAt').lean();
      if (!livestream || livestream.status === 'ended' || livestream.endedAt) return;

      if (!socket.data.isGuest) {
        await LivestreamParticipant.findOneAndUpdate(
          { livestreamId, userId },
          { $setOnInsert: { livestreamId, userId, joinedAt: new Date() } },
          { upsert: true },
        );
      }

      const joinedAt = new Date().toISOString();
      socket.data.joinedAt = joinedAt;
      socket.data.sharingCamera = false;

      const room = `livestream:${livestreamId}`;
      socket.join(room);

      const roomSockets = await ioInstance!.in(room).fetchSockets();
      const viewers = roomSockets.map((roomSocket) => ({
        userId: String(roomSocket.data.userId ?? ''),
        isGuest: Boolean(roomSocket.data.isGuest),
        joinedAt: String(roomSocket.data.joinedAt ?? joinedAt),
        sharingCamera: Boolean(roomSocket.data.sharingCamera),
      }));

      socket.emit('livestream:presence-snapshot', { livestreamId, viewers });
      await broadcastViewerCount(livestreamId, room);

      const currentSession = await LivestreamSession.findById(livestreamId).select('metadata').lean();
      const currentPeak =
        typeof currentSession?.metadata?.peakViewerCount === 'number'
          ? currentSession.metadata.peakViewerCount
          : 0;
      if (roomSockets.length > currentPeak) {
        await LivestreamSession.updateOne(
          { _id: livestreamId },
          { $set: { 'metadata.peakViewerCount': roomSockets.length } },
        );
      }

      emitPresence(livestreamId, {
        userId,
        isGuest: Boolean(socket.data.isGuest),
        joinedAt,
        sharingCamera: false,
      });
    });

    socket.on(
      'livestream:camera-status',
      (payload: { livestreamId?: string; sharingCamera?: boolean }) => {
        const livestreamId = payload?.livestreamId;
        if (!livestreamId) return;
        socket.data.sharingCamera = Boolean(payload.sharingCamera);
        ioInstance?.to(`livestream:${livestreamId}`).emit('livestream:presence', {
          type: 'viewer.camera',
          livestreamId,
          userId,
          isGuest: Boolean(socket.data.isGuest),
          sharingCamera: Boolean(payload.sharingCamera),
          updatedAt: new Date().toISOString(),
        });
      },
    );

    socket.on('livestream:leave', async (payload: { livestreamId?: string }) => {
      const livestreamId = payload?.livestreamId;
      if (!livestreamId) return;
      const room = `livestream:${livestreamId}`;
      socket.leave(room);
      ioInstance?.to(room).emit('livestream:presence', {
        type: 'viewer.left',
        livestreamId,
        userId,
        isGuest: Boolean(socket.data.isGuest),
        leftAt: new Date().toISOString(),
      });
      await broadcastViewerCount(livestreamId, room);
    });

    socket.on('chat:join', (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.join(`chat:${conversationId}`);
    });

    socket.on('chat:leave', (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.leave(`chat:${conversationId}`);
    });

    socket.on('disconnect', () => {
      logger.debug({ userId }, 'Livestream socket disconnected');
      const rooms = [...socket.rooms].filter((room) => room.startsWith('livestream:'));
      void Promise.all(
        rooms.map(async (room) => {
          const livestreamId = room.slice('livestream:'.length);
          await broadcastViewerCount(livestreamId, room);
        }),
      );
    });
  });

  logger.info('E-commerce livestream socket initialized with Redis adapter');
  return ioInstance;
};

export const notifyLivestreamFollowers = async (
  userIds: string[],
  payload: { title: string; body: string; livestreamId: string },
): Promise<void> => {
  const { publishNotificationDispatch } = await import('../kafka/index.js');
  await Promise.all(
    userIds.map((targetUserId) =>
      publishNotificationDispatch({
        userId: targetUserId,
        category: 'live',
        title: payload.title,
        body: payload.body,
        accent: 'info',
        metadata: { livestreamId: payload.livestreamId },
      }),
    ),
  );
};
