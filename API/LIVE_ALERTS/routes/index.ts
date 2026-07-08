import { OpenAPIHono } from '@hono/zod-openapi';
import { requireRole } from '../../../CORE/middlewares/rbac/index.js';
import { ROLE_NAMES } from '../../../CORE/utils/constants/index.js';
import {
  fetchLiveAlertStatusController,
  fetchMyLiveAlertSubscriptionsController,
  removeLiveAlertSubscriptionController,
  upsertLiveAlertSubscriptionController,
} from '../services/manage.subscription/index.js';

const authenticated = requireRole([
  ROLE_NAMES.USER,
  ROLE_NAMES.VENDOR,
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.ADMIN_L1,
]) as never;

export const liveAlertsRouter = new OpenAPIHono({ strict: false });

liveAlertsRouter.get('/mine', authenticated, fetchMyLiveAlertSubscriptionsController as never);
liveAlertsRouter.get('/status', authenticated, fetchLiveAlertStatusController as never);
liveAlertsRouter.put('/subscribe', authenticated, upsertLiveAlertSubscriptionController as never);
liveAlertsRouter.delete('/subscribe', authenticated, removeLiveAlertSubscriptionController as never);
