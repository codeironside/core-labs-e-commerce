import type { Context } from 'hono';
import mongoose from 'mongoose';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { logger } from '../../../../CORE/services/logger/index.js';
import { emitToChatRoom } from '../../../../CORE/services/socket/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { StoreChat, StoreChatMessage, StoreManager, VendorStore } from '../../models/index.js';

const resolveSessionUserId = (context: Context): string => {
  const sessionUser = context.get('user');
  if (!sessionUser) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }
  return String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
};

const isStoreOwnerOrManager = async (storeId: string, userId: string): Promise<boolean> => {
  const store = await VendorStore.findById(storeId).select('vendorId status').lean();
  if (!store || store.status !== 'active') return false;
  if (String(store.vendorId) === userId) return true;

  const assignment = await StoreManager.findOne({
    storeId: store._id,
    userId: new mongoose.Types.ObjectId(userId),
    role: { $in: ['manager', 'streamer'] },
  })
    .select('_id')
    .lean();
  return Boolean(assignment);
};

const assertCanAccessConversation = async (
  conversationId: string,
  userId: string,
): Promise<{ conversation: any; isStaff: boolean }> => {
  const conversation = await StoreChat.findById(conversationId).lean();
  if (!conversation) {
    throw new AppError('Conversation not found.', 404);
  }

  if (String(conversation.buyerUserId) === userId) {
    return { conversation, isStaff: false };
  }

  const canAccessAsStaff = await isStoreOwnerOrManager(String(conversation.storeId), userId);
  if (!canAccessAsStaff) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  return { conversation, isStaff: true };
};

export const startStoreChatController = async (context: Context) => {
  const userId = resolveSessionUserId(context);
  const storeId = context.req.param('storeId');
  if (!storeId || !mongoose.isValidObjectId(storeId)) {
    throw new AppError('Store not found.', 404);
  }

  const store = await VendorStore.findById(storeId).select('_id vendorId name slug logoUrl status').lean();
  if (!store || store.status !== 'active') {
    throw new AppError('Store not found.', 404);
  }

  if (String(store.vendorId) === userId) {
    throw new AppError('Store owners should use vendor inbox directly.', 400);
  }

  const existing = await StoreChat.findOne({
    storeId: store._id,
    buyerUserId: new mongoose.Types.ObjectId(userId),
  }).lean();

  const conversation = existing ?? (await StoreChat.create({
    storeId: store._id,
    vendorId: store.vendorId,
    buyerUserId: new mongoose.Types.ObjectId(userId),
    lastMessage: 'Conversation started',
    lastMessageAt: new Date(),
  }));

  return ResponseHandler.success(context, 'Conversation ready.', {
    conversation: {
      id: String(conversation._id),
      vendorId: String(store.vendorId),
      vendorName: store.name,
      vendorSlug: store.slug,
      vendorAvatarUrl: store.logoUrl ?? undefined,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: 0,
      category: 'inquiries',
      storeId: String(store._id),
    },
  });
};

export const fetchMyStoreChatsController = async (context: Context) => {
  const userId = resolveSessionUserId(context);

  const ownedStores = await VendorStore.find({ vendorId: userId, status: 'active' }).select('_id').lean();
  const managerStores = await StoreManager.find({
    userId: new mongoose.Types.ObjectId(userId),
    role: { $in: ['manager', 'streamer'] },
  }).select('storeId').lean();
  const staffStoreIds = [...new Set([...ownedStores.map((entry) => String(entry._id)), ...managerStores.map((entry) => String(entry.storeId))])];

  const match =
    staffStoreIds.length > 0
      ? {
          $or: [
            { buyerUserId: new mongoose.Types.ObjectId(userId) },
            { storeId: { $in: staffStoreIds.map((id) => new mongoose.Types.ObjectId(id)) } },
          ],
        }
      : { buyerUserId: new mongoose.Types.ObjectId(userId) };

  const conversations = await StoreChat.find(match)
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();

  const storeIds = [...new Set(conversations.map((entry) => String(entry.storeId)))];
  const buyerIds = [...new Set(conversations.map((entry) => String(entry.buyerUserId)))];
  const [stores, buyers] = await Promise.all([
    VendorStore.find({ _id: { $in: storeIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select('_id vendorId name slug logoUrl')
      .lean(),
    User.find({ _id: { $in: buyerIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select('_id name email')
      .lean(),
  ]);

  const storeMap = new Map(stores.map((entry) => [String(entry._id), entry]));
  const buyerMap = new Map(buyers.map((entry) => [String(entry._id), entry]));

  const items = conversations.map((entry) => {
    const store = storeMap.get(String(entry.storeId));
    const buyer = buyerMap.get(String(entry.buyerUserId));
    const isStaffConversation = staffStoreIds.includes(String(entry.storeId)) && String(entry.buyerUserId) !== userId;

    return {
      id: String(entry._id),
      vendorId: String(entry.vendorId),
      vendorName: isStaffConversation
        ? (buyer?.name ?? buyer?.email ?? 'Buyer')
        : (store?.name ?? 'Store'),
      vendorSlug: store?.slug,
      vendorAvatarUrl: store?.logoUrl ?? undefined,
      lastMessage: entry.lastMessage,
      lastMessageAt: entry.lastMessageAt,
      unreadCount: 0,
      category: 'inquiries',
      storeId: String(entry.storeId),
      isStaffConversation,
    };
  });

  return ResponseHandler.success(context, 'Conversations fetched.', {
    items,
    unreadCount: 0,
  });
};

export const fetchStoreChatMessagesController = async (context: Context) => {
  const userId = resolveSessionUserId(context);
  const chatId = context.req.param('chatId');
  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    throw new AppError('Conversation not found.', 404);
  }

  const { conversation } = await assertCanAccessConversation(chatId, userId);
  const store = await VendorStore.findById(conversation.storeId).select('name slug logoUrl vendorId').lean();

  const messages = await StoreChatMessage.find({ conversationId: conversation._id })
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();

  const senderIds = [...new Set(messages.map((entry) => String(entry.senderUserId)))];
  const senders = await User.find({ _id: { $in: senderIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .select('_id name email')
    .lean();
  const senderMap = new Map(
    senders.map((entry) => [String(entry._id), entry.name ?? entry.email ?? 'Member']),
  );

  return ResponseHandler.success(context, 'Conversation fetched.', {
    conversation: {
      id: String(conversation._id),
      vendorId: String(store?.vendorId ?? conversation.vendorId),
      vendorName: store?.name ?? 'Store',
      vendorSlug: store?.slug,
      vendorAvatarUrl: store?.logoUrl ?? undefined,
      lastMessage: conversation.lastMessage,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: 0,
      category: 'inquiries',
      storeId: String(conversation.storeId),
    },
    messages: messages.map((entry) => ({
      id: String(entry._id),
      conversationId: String(entry.conversationId),
      text: entry.text,
      sentAt: entry.createdAt,
      senderUserId: String(entry.senderUserId),
      senderName: senderMap.get(String(entry.senderUserId)) ?? 'Member',
      isOutgoing: String(entry.senderUserId) === userId,
      imageUrl: entry.imageUrl,
    })),
  });
};

export const sendStoreChatMessageController = async (context: Context) => {
  const userId = resolveSessionUserId(context);
  const chatId = context.req.param('chatId');
  if (!chatId || !mongoose.isValidObjectId(chatId)) {
    throw new AppError('Conversation not found.', 404);
  }

  const body = await context.req.json().catch(() => ({}));
  const text = String(body.text ?? '').trim();
  const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : undefined;
  if (!text && !imageUrl) {
    throw new AppError('Message cannot be empty.', 400);
  }

  const { conversation } = await assertCanAccessConversation(chatId, userId);

  const sender = await User.findById(userId).select('name email').lean();
  const senderName = sender?.name ?? sender?.email ?? 'Member';

  const message = await StoreChatMessage.create({
    conversationId: conversation._id,
    storeId: conversation.storeId,
    senderUserId: new mongoose.Types.ObjectId(userId),
    text: text || 'Sent an image',
    ...(imageUrl ? { imageUrl } : {}),
  });

  await StoreChat.updateOne(
    { _id: conversation._id },
    { $set: { lastMessage: message.text, lastMessageAt: message.createdAt } },
  );

  const payload = {
    id: String(message._id),
    conversationId: String(message.conversationId),
    text: message.text,
    sentAt: message.createdAt.toISOString(),
    senderUserId: String(message.senderUserId),
    senderName,
    imageUrl: message.imageUrl,
  };

  emitToChatRoom(String(message.conversationId), 'chat:message', payload);
  logger.info({ chatId, senderUserId: userId }, 'Store chat message sent');

  return ResponseHandler.success(context, 'Message sent.', {
    ...payload,
    isOutgoing: true,
  });
};
