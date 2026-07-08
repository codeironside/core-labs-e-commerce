import type { Context } from 'hono';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { User } from '../../../AUTH/models/index.js';
import { recordHighlightMoment } from '../../utils/highlightMoments.js';

export const captureHighlightMomentController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamId = context.req.param('livestreamId');

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const recorded = await recordHighlightMoment({
    livestreamId,
    source: 'capture',
    label: 'Highlight',
    onlyWhenActive: true,
  });

  if (!recorded) {
    throw new AppError('Could not capture highlight. Stream may be inactive or moment too recent.', 409);
  }

  return ResponseHandler.success(context, 'Highlight captured. Clips are generated when the stream ends.', {
    queued: true,
  });
};
