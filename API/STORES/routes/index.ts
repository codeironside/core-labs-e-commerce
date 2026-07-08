import { OpenAPIHono } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import { fetchPublicStorefrontsController } from '../services/fetch.public.storefronts/index.js';
import { fetchPublicStoreController } from '../services/fetch.public.store/index.js';
import { createStoreController } from '../services/create.store/index.js';
import { fetchVendorStoresController } from '../services/fetch.vendor.stores/index.js';
import {
  assignStoreManagerController,
  removeStoreManagerController,
} from '../services/assign.store.manager/index.js';
import {
  assignStoreProductsController,
  fetchStoreController,
  updateStoreProductInventoryController,
  updateStoreController,
} from '../services/manage.store/index.js';
import {
  fetchMyStoreChatsController,
  fetchStoreChatMessagesController,
  sendStoreChatMessageController,
  startStoreChatController,
} from '../services/store.chat/index.js';

const vendorOrMember = requireRole([ROLE_NAMES.VENDOR, ROLE_NAMES.USER]) as never;
const vendorOrAdmin = requireRole([ROLE_NAMES.VENDOR, ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN]) as never;
const vendorOnly = requireRole([ROLE_NAMES.VENDOR]) as never;

export const storesRouter = new OpenAPIHono({ strict: false });

storesRouter.get('/public', fetchPublicStorefrontsController as never);
storesRouter.get('/public/:slug', fetchPublicStoreController as never);

storesRouter.get('/vendor/mine', vendorOrMember, fetchVendorStoresController as never);
storesRouter.get('/vendor/:storeId', vendorOrMember, fetchStoreController as never);

storesRouter.post('/vendor', vendorOrAdmin, createStoreController as never);
storesRouter.patch('/vendor/:storeId', vendorOrAdmin, updateStoreController as never);
storesRouter.post('/vendor/:storeId/products', vendorOrAdmin, assignStoreProductsController as never);
storesRouter.patch('/vendor/:storeId/products/:productId/inventory', vendorOrMember, updateStoreProductInventoryController as never);

storesRouter.post('/vendor/:storeId/managers', vendorOnly, assignStoreManagerController as never);
storesRouter.delete('/vendor/:storeId/managers/:userId', vendorOnly, removeStoreManagerController as never);

storesRouter.post('/:storeId/chats', vendorOrMember, startStoreChatController as never);
storesRouter.get('/chats/mine', vendorOrMember, fetchMyStoreChatsController as never);
storesRouter.get('/chats/:chatId/messages', vendorOrMember, fetchStoreChatMessagesController as never);
storesRouter.post('/chats/:chatId/messages', vendorOrMember, sendStoreChatMessageController as never);
