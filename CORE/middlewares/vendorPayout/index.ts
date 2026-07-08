import type { Context, Next } from 'hono';
import { AppError } from '../../handlers/error/index.js';
import { SYSTEM_MESSAGES } from '../../utils/constants/index.js';
import type { IdentitySessionUser } from '../auth/index.js';
import { User } from '../../../API/AUTH/models/index.js';

const hasPayoutConfigured = (vendorProfile: {
  address?: string;
  addressDetails?: { line1?: string; city?: string };
  payoutMethod?: string;
  bankDetails?: { accountNumber?: string };
  cryptoWalletAddress?: string;
} | null | undefined): boolean => {
  if (!vendorProfile?.address && !vendorProfile?.addressDetails?.line1) {
    return false;
  }
  if (vendorProfile.payoutMethod === 'bank') {
    return Boolean(vendorProfile.bankDetails?.accountNumber);
  }
  if (vendorProfile.payoutMethod === 'usdc') {
    return Boolean(vendorProfile.cryptoWalletAddress && vendorProfile.cryptoWalletAddress.length >= 10);
  }
  return Boolean(vendorProfile.bankDetails?.accountNumber || vendorProfile.cryptoWalletAddress);
};

export const requireVendorPayoutSetup = () => async (context: Context, next: Next): Promise<void> => {
  const sessionUser = context.get('user') as IdentitySessionUser | undefined;
  if (!sessionUser?.userId) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }

  const vendor = await User.findById(sessionUser.userId).select('vendorProfile onboardingComplete').lean();
  if (!vendor) {
    throw new AppError(SYSTEM_MESSAGES.ERRORS.UNAUTHORIZED, 401);
  }

  if (!hasPayoutConfigured(vendor.vendorProfile as Parameters<typeof hasPayoutConfigured>[0])) {
    throw new AppError(
      'Complete vendor onboarding with your business address and payout method (bank or USDC) before selling.',
      403,
    );
  }

  await next();
};
