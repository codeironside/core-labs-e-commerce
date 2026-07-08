import { OpenAPIHono } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import { payOrderController } from '../services/pay.order/index.js';
import { fetchMyAuctionWinsController } from '../services/fetch.my.auction.wins/index.js';
import { fetchVendorOrdersController } from '../services/fetch.vendor.orders/index.js';
import {
  grantPayLaterController,
  sendWinnerMessageController,
} from '../services/vendor.auction.order/index.js';

export const ordersRouter = new OpenAPIHono({ strict: false });

ordersRouter.use('/*', requireRole([ROLE_NAMES.USER, ROLE_NAMES.VENDOR, ROLE_NAMES.ADMIN, ROLE_NAMES.ADMIN_L1]));
ordersRouter.get('/my-auction-wins', fetchMyAuctionWinsController as never);
ordersRouter.get('/vendor/mine', requireRole([ROLE_NAMES.VENDOR]), fetchVendorOrdersController as never);
ordersRouter.post('/vendor/:orderId/pay-later', requireRole([ROLE_NAMES.VENDOR]), grantPayLaterController as never);
ordersRouter.post('/vendor/:orderId/winner-message', requireRole([ROLE_NAMES.VENDOR]), sendWinnerMessageController as never);
ordersRouter.post('/:orderId/pay', payOrderController as never);
