import { z } from 'zod';
import mongoose from 'mongoose';
import { UserModel, type UserRole } from '@api/AUTH/models';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import { MESSAGES } from '@core/constants/messages';
import { findUserById } from '@core/services/db/userLookup';
import { assertCanManageTargetUser } from '@api/ADMIN/services/assertCanManageUser';

const BanSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const banUserFromPlatform = async (
  actorId: string,
  actorRole: UserRole,
  targetUserId: string,
  body: unknown,
): Promise<void> => {
  const payload = BanSchema.parse(body);
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
  }

  assertCanManageTargetUser({ userId: actorId, role: actorRole }, target);

  target.platformBanned = true;
  target.platformBanReason = payload.reason;
  target.platformBannedAt = new Date();
  target.platformBannedBy = new mongoose.Types.ObjectId(actorId);
  await target.save();
};

export const unbanUserFromPlatform = async (
  actorId: string,
  actorRole: UserRole,
  targetUserId: string,
): Promise<void> => {
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
  }

  assertCanManageTargetUser({ userId: actorId, role: actorRole }, target);

  target.platformBanned = false;
  target.platformBanReason = undefined;
  target.platformBannedAt = undefined;
  target.platformBannedBy = undefined;
  await target.save();
};

export const banUserFromLivestreams = async (
  actorId: string,
  actorRole: UserRole,
  targetUserId: string,
  body: unknown,
): Promise<void> => {
  const payload = BanSchema.parse(body);
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
  }

  assertCanManageTargetUser({ userId: actorId, role: actorRole }, target);

  target.livestreamBanned = true;
  target.livestreamBanReason = payload.reason;
  target.livestreamBannedAt = new Date();
  target.livestreamBannedBy = new mongoose.Types.ObjectId(actorId);
  await target.save();
};

export const unbanUserFromLivestreams = async (
  actorId: string,
  actorRole: UserRole,
  targetUserId: string,
): Promise<void> => {
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
  }

  assertCanManageTargetUser({ userId: actorId, role: actorRole }, target);

  target.livestreamBanned = false;
  target.livestreamBanReason = undefined;
  target.livestreamBannedAt = undefined;
  target.livestreamBannedBy = undefined;
  await target.save();
};

export const listVendorsForAdmin = async (
  actorRole: UserRole,
  page: number,
  limit: number,
): Promise<{ vendors: Array<Record<string, unknown>>; total: number }> => {
  const filter: Record<string, unknown> = { userType: ONBOARDING_USER_TYPES.VENDOR };
  if (actorRole !== 'super_admin') {
    filter.role = { $ne: 'super_admin' };
  }

  const skip = (page - 1) * limit;
  const [vendors, total] = await Promise.all([
    UserModel.find(filter)
      .select('name email role userType vendorProfile createdAt platformBanned livestreamBanned')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return {
    vendors: vendors as unknown as Array<Record<string, unknown>>,
    total,
  };
};

export const activateVendorLivestream = async (
  actorId: string,
  actorRole: UserRole,
  targetUserId: string,
  vendorPhotoUrl: string,
): Promise<{ canGoLive: boolean; vendorPhotoUrl: string }> => {
  const target = await findUserById(targetUserId);
  if (!target) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
  }

  assertCanManageTargetUser({ userId: actorId, role: actorRole }, target);

  if (target.userType !== ONBOARDING_USER_TYPES.VENDOR || !target.vendorProfile) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Target user is not a vendor.');
  }

  target.vendorProfile.canGoLive = true;
  target.vendorProfile.vendorActivationPhotoUrl = vendorPhotoUrl;
  target.vendorProfile.vendorActivationApprovedAt = new Date();
  target.vendorProfile.vendorActivationApprovedBy = new mongoose.Types.ObjectId(actorId);
  target.vendorProfile.identityVerificationStatus = 'admin_bypass';
  target.markModified('vendorProfile');
  await target.save();

  return { canGoLive: true, vendorPhotoUrl };
};
