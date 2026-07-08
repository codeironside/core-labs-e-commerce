import type { Context } from 'hono';
import { z } from 'zod';
import { logger } from '../../../../CORE/services/logger/index.js';
import { ResponseHandler } from '../../../../CORE/handlers/response/index.js';
import { AppError } from '../../../../CORE/handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../../../CORE/utils/constants/index.js';
import { LivestreamSession } from '../../models/index.js';
import { User } from '../../../AUTH/models/index.js';

const HighlightSchema = z.object({
  url: z.string().url(),
  publicId: z.string().optional(),
  label: z.string().max(120).optional(),
  isPublic: z.boolean().default(false),
});

const RecordingVisibilitySchema = z.object({
  recordingPublic: z.boolean(),
});

export const addLivestreamHighlightController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamId = context.req.param('livestreamId');
  const payload = HighlightSchema.parse(await context.req.json().catch(() => ({})));

  const vendor = await User.findById(vendorId).select('userType').lean();
  if (!vendor || String(vendor.userType).toLowerCase() !== 'vendor') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const livestream = await LivestreamSession.findOneAndUpdate(
    { _id: livestreamId, vendorId, status: 'active' },
    {
      $push: {
        highlights: {
          url: payload.url,
          publicId: payload.publicId,
          label: payload.label,
          isPublic: payload.isPublic,
          createdAt: new Date(),
        },
      },
    },
    { new: true },
  )
    .select('highlights recordingPublic adminRecordingOverride')
    .lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  return ResponseHandler.success(context, 'Highlight saved.', { highlights: livestream.highlights });
};

export const setRecordingVisibilityController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const vendorId = String(sessionUser.id ?? sessionUser._id ?? sessionUser.userId);
  const livestreamId = context.req.param('livestreamId');
  const payload = RecordingVisibilitySchema.parse(await context.req.json().catch(() => ({})));

  const livestream = await LivestreamSession.findOneAndUpdate(
    { _id: livestreamId, vendorId },
    { $set: { recordingPublic: payload.recordingPublic } },
    { new: true },
  )
    .select('recordingUrl recordingPublic highlights adminRecordingOverride')
    .lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  return ResponseHandler.success(context, 'Recording visibility updated.', {
    recordingPublic: livestream.recordingPublic,
  });
};

export const adminManageRecordingController = async (context: Context) => {
  const sessionUser = context.get('user');
  if (!sessionUser) throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);

  const actorRole = String(sessionUser.role ?? '').toLowerCase();
  if (actorRole !== 'admin' && actorRole !== 'super_admin') {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.FORBIDDEN, 403);
  }

  const livestreamId = context.req.param('livestreamId');
  const body = z
    .object({
      action: z.enum(['force_hidden', 'restore_public', 'delete_recording']),
    })
    .parse(await context.req.json().catch(() => ({})));

  const update =
    body.action === 'delete_recording'
      ? {
          $set: {
            adminRecordingOverride: 'deleted' as const,
            recordingUrl: undefined,
            recordingPublic: false,
            highlights: [],
          },
        }
      : body.action === 'force_hidden'
        ? { $set: { adminRecordingOverride: 'force_hidden' as const, recordingPublic: false } }
        : { $unset: { adminRecordingOverride: 1 }, $set: { recordingPublic: false } };

  const livestream = await LivestreamSession.findByIdAndUpdate(livestreamId, update, { new: true })
    .select('recordingUrl recordingPublic adminRecordingOverride highlights')
    .lean();

  if (!livestream) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.LIVESTREAM_NOT_FOUND, 404);
  }

  logger.info({ livestreamId, action: body.action, actorRole }, 'Admin recording override applied');

  return ResponseHandler.success(context, 'Recording updated by admin.', { livestream });
};
