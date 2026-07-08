export const ONBOARDING_REDIS_PREFIX = 'onboarding:state:';
export const ONBOARDING_PENDING_PREFIX = 'onboarding:pending:';
export const ONBOARDING_EMAIL_PREFIX = 'onboarding:email:';
export const ONBOARDING_STEPS = {
    BASIC: 'basic',
    GUIDELINES: 'guidelines',
    CATEGORIES: 'categories',
    SUBCATEGORIES: 'subcategories',
    EXPERIENCE: 'experience',
    SOCIAL: 'social',
    ADDRESS: 'address',
    PAYOUT: 'payout',
    PAYOUT_DETAILS: 'payout_details',
    IDENTITY: 'identity',
    VENDOR_PROFILE: 'vendor_profile',
    VENDOR_BANK: 'vendor_bank',
    COMPLETE: 'complete',
};
export const ONBOARDING_USER_TYPES = {
    VENDOR: 'vendor',
    BUYER: 'buyer',
    EDITOR: 'editor',
};
export const VENDOR_ONBOARDING_FLOW = [
    ONBOARDING_STEPS.GUIDELINES,
    ONBOARDING_STEPS.CATEGORIES,
    ONBOARDING_STEPS.SUBCATEGORIES,
    ONBOARDING_STEPS.EXPERIENCE,
    ONBOARDING_STEPS.SOCIAL,
    ONBOARDING_STEPS.ADDRESS,
    ONBOARDING_STEPS.PAYOUT,
    ONBOARDING_STEPS.PAYOUT_DETAILS,
    ONBOARDING_STEPS.IDENTITY,
    ONBOARDING_STEPS.COMPLETE,
];
export const ONBOARDING_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
export const getVendorNextStep = (currentStep) => {
    const flowIndex = VENDOR_ONBOARDING_FLOW.indexOf(currentStep);
    if (flowIndex === -1) {
        return ONBOARDING_STEPS.CATEGORIES;
    }
    if (flowIndex >= VENDOR_ONBOARDING_FLOW.length - 1) {
        return ONBOARDING_STEPS.COMPLETE;
    }
    return VENDOR_ONBOARDING_FLOW[flowIndex + 1];
};
