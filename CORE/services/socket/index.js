import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
const SOCKET_BRIDGE_CHANNEL = 'platform:socket:emit';
let ioInstance = null;
const authenticateSocket = (socket, next) => {
    const token = socket.handshake.auth?.token
        ?? (typeof socket.handshake.headers.authorization === 'string'
            ? socket.handshake.headers.authorization.replace('Bearer ', '')
            : undefined);
    if (!token) {
        next(new Error('Socket authentication failed: no token'));
        return;
    }
    try {
        const payload = jwt.verify(token, config.jwt.accessSecret);
        socket.data.userId = payload.userId;
        socket.data.workspaceId = payload.workspaceId;
        socket.data.role = payload.role;
        next();
    }
    catch {
        next(new Error('Socket authentication failed: invalid token'));
    }
};
export const initSocket = (httpServer) => {
    ioInstance = new Server(httpServer, {
        cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
        transports: ['websocket', 'polling'],
    });
    ioInstance.use(authenticateSocket);
    ioInstance.on('connection', (socket) => {
        const { userId, workspaceId } = socket.data;
        socket.join(`user:${userId}`);
        socket.join(`workspace:${workspaceId}`);
        logger.info({ userId, workspaceId, socketId: socket.id }, 'Socket connected');
        socket.on('chat:join_support', () => {
            socket.join(`support:${userId}`);
            logger.info({ userId }, 'User joined support room');
        });
        socket.on('disconnect', (reason) => {
            logger.info({ userId, reason }, 'Socket disconnected');
        });
    });
    logger.info('Identity Socket.io initialized');
    return ioInstance;
};
export const getSocketServer = () => {
    if (!ioInstance) {
        throw new Error('Socket.io not initialized');
    }
    return ioInstance;
};
export const emitToUser = (userId, event, payload) => {
    if (!ioInstance)
        return;
    ioInstance.to(`user:${userId}`).emit(event, payload);
};
export const startSocketRedisBridge = async () => {
    const { getRedisClient } = await import('../redis/index.js');
    const subscriber = getRedisClient().duplicate();
    subscriber.on('message', (channel, message) => {
        if (channel !== SOCKET_BRIDGE_CHANNEL)
            return;
        try {
            const payload = JSON.parse(message);
            if (!payload.userId || !payload.event)
                return;
            emitToUser(payload.userId, payload.event, payload.payload);
        }
        catch (error) {
            logger.error({ error }, 'Socket redis bridge message failed');
        }
    });
    await subscriber.subscribe(SOCKET_BRIDGE_CHANNEL);
    logger.info({ channel: SOCKET_BRIDGE_CHANNEL }, 'Socket redis bridge listening');
};
