import { z } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
import { findUserById } from '@core/services/db/userLookup';

const VendorIdentityBypassSchema = z.object({
  adminBypassPhotoUrl: z.string().url(),
  note: z.string().max(500).optional(),
});

export const bypassVendorIdentityVerification = async (
  userId: string,
  body: unknown,
): Promise<{ canGoLive: boolean }> => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid user id');
  }

  const payload = VendorIdentityBypassSchema.parse(body);
  const user = await findUserById(userId);

  if (!user) {
    throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.AUTH.UNAUTHORIZED);
  }

  if (user.userType !== ONBOARDING_USER_TYPES.VENDOR || !user.vendorProfile) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Target user is not a vendor.');
  }

  user.vendorProfile.identityVerificationStatus = 'admin_bypass';
  user.vendorProfile.canGoLive = true;
  user.vendorProfile.adminBypassPhotoUrl = payload.adminBypassPhotoUrl;
  user.vendorProfile.identitySkipped = false;
  user.markModified('vendorProfile');
  await user.save();

  return { canGoLive: true };
};
