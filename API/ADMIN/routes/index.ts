import { OpenAPIHono } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import { fetchAdminOverviewController } from '../services/fetch.overview/index.js';
import { fetchVendorDetailController } from '../services/fetch.vendor.detail/index.js';
import { fetchCommerceAnalyticsController } from '../services/fetch.commerce.analytics/index.js';
import {
  deleteLivestreamCommentController,
  listLivestreamCommentsController,
  listLivestreamsForModerationController,
} from '../services/livestream.moderation/index.js';

export const adminRouter = new OpenAPIHono({ strict: false });

const adminOnlyMiddleware = requireRole([ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN]);

adminRouter.use('/*', adminOnlyMiddleware);
adminRouter.get('/overview', fetchAdminOverviewController);
adminRouter.get('/commerce/analytics', fetchCommerceAnalyticsController);
adminRouter.get('/commerce/vendors/:vendorId/detail', fetchVendorDetailController);
adminRouter.get('/commerce/livestreams', listLivestreamsForModerationController);
adminRouter.get('/commerce/livestreams/comments', listLivestreamCommentsController);
adminRouter.delete('/commerce/livestreams/comments/:commentId', deleteLivestreamCommentController);
