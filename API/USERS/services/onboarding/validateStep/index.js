import { ONBOARDING_STEPS, ONBOARDING_USER_TYPES, getVendorNextStep } from '@core/constants/onboarding';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
const formatAddress = (details) => [details.line1, details.line2, details.city, details.state, details.postalCode, details.country]
    .filter(Boolean)
    .join(', ');
export const getNextStepForUserType = (userType, currentStep, workspaceRole) => {
    if (workspaceRole === 'admin' || workspaceRole === 'super_admin') {
        return ONBOARDING_STEPS.COMPLETE;
    }
    if (userType === ONBOARDING_USER_TYPES.VENDOR) {
        if (currentStep === ONBOARDING_STEPS.BASIC) {
            return ONBOARDING_STEPS.GUIDELINES;
        }
        return getVendorNextStep(currentStep);
    }
    return ONBOARDING_STEPS.COMPLETE;
};
export const assertOnboardingReadyToComplete = (state) => {
    const { draft } = state;
    if (state.requiresPhoneNumber && !draft.phoneNumber) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Phone number is required for accounts signed up with Google or social login.');
    }
    if (state.role === 'admin' || state.role === 'super_admin') {
        return;
    }
    if (!draft.userType) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'userType is required before completing onboarding.');
    }
    if (draft.userType !== ONBOARDING_USER_TYPES.VENDOR) {
        if (draft.userType === ONBOARDING_USER_TYPES.BUYER) {
            if (!draft.categories?.length || !draft.subcategories?.length) {
                throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Buyer categories and subcategories are required.');
            }
        }
        return;
    }
    if (!draft.agreedToGuidelines) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Seller guidelines must be accepted.');
    }
    if (!draft.categories?.length || !draft.subcategories?.length) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Vendor categories and subcategories are required.');
    }
    if (!draft.sellingExperience || !draft.businessStatus) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Selling experience is required.');
    }
    if (!draft.socialChannels?.length) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'At least one social channel is required.');
    }
    if (!draft.addressDetails) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Business address is required.');
    }
    if (!draft.payoutMethod) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Payout method is required.');
    }
    if (draft.payoutMethod === 'bank') {
        if (!draft.bankDetails?.bankCode || !draft.bankDetails.accountNumber || !draft.bankDetails.accountName) {
            throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Verified bank details are required.');
        }
    }
    if (draft.payoutMethod === 'usdc' && !draft.cryptoWalletAddress) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'USDC wallet address is required.');
    }
};
const resolveIdentityStatus = (draft) => {
    if (draft.identityVerificationStatus === 'admin_bypass')
        return 'admin_bypass';
    if (draft.identitySkipped)
        return 'skipped';
    if (draft.identityVerification?.ninVerified)
        return 'verified';
    if (draft.identityVerification?.documentType && draft.identityVerification.documentType !== 'nin') {
        return 'pending';
    }
    return 'pending';
};
export const buildVendorProfileFromDraft = (draft) => {
    const identityVerificationStatus = resolveIdentityStatus(draft);
    const canGoLive = identityVerificationStatus === 'verified' || identityVerificationStatus === 'admin_bypass';
    return {
        categories: draft.categories,
        subcategories: draft.subcategories,
        businessStatus: draft.businessStatus,
        sellingExperience: draft.sellingExperience,
        socialChannels: draft.socialChannels,
        address: draft.address ?? (draft.addressDetails ? formatAddress(draft.addressDetails) : ''),
        addressDetails: draft.addressDetails,
        ...(draft.cacNumber ? { cacNumber: draft.cacNumber } : {}),
        payoutMethod: draft.payoutMethod,
        ...(draft.bankDetails ? { bankDetails: draft.bankDetails } : {}),
        ...(draft.cryptoWalletAddress ? { cryptoWalletAddress: draft.cryptoWalletAddress } : {}),
        ...(draft.identityVerification ? { identityVerification: draft.identityVerification } : {}),
        identityVerificationStatus,
        identitySkipped: draft.identitySkipped ?? false,
        canGoLive,
        agreedToGuidelines: draft.agreedToGuidelines,
        tutorialCompleted: draft.tutorialCompleted ?? false,
    };
};
