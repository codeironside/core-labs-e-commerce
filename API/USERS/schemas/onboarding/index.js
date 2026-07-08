import { z } from 'zod';
import { ONBOARDING_USER_TYPES } from '@core/constants/onboarding';
const tokenField = z.object({ onboardingToken: z.string().uuid() });
export const OnboardingTokenSchema = tokenField;
export const OnboardingBasicStepSchema = z.object({
    onboardingToken: z.string().uuid(),
    username: z.string().regex(/^[a-zA-Z0-9_-]{3,30}$/).optional(),
    phoneNumber: z.string().min(7).max(20).optional(),
    userType: z.enum([
        ONBOARDING_USER_TYPES.VENDOR,
        ONBOARDING_USER_TYPES.BUYER,
        ONBOARDING_USER_TYPES.EDITOR,
    ]),
    categories: z.array(z.string().min(1)).optional(),
    subcategories: z.array(z.string().min(1)).optional(),
});
export const OnboardingGuidelinesStepSchema = tokenField.extend({
    agreedToGuidelines: z.literal(true),
    phoneConsent: z.boolean().default(false),
    phoneNumber: z.string().min(7).max(20).optional(),
});
export const OnboardingCategoriesStepSchema = tokenField.extend({
    categories: z.array(z.string().min(1)).min(1),
});
export const OnboardingSubcategoriesStepSchema = tokenField.extend({
    subcategories: z.array(z.string().min(1)).min(1),
});
export const OnboardingExperienceStepSchema = tokenField.extend({
    sellingExperience: z.enum(['starting', 'active']),
    businessStatus: z.enum(['registered', 'unregistered']),
});
export const OnboardingSocialStepSchema = tokenField.extend({
    socialChannels: z.array(z.string().min(1)).min(1),
});
export const OnboardingAddressStepSchema = tokenField.extend({
    phoneNumber: z.string().min(7).max(20).optional(),
    addressDetails: z.object({
        fullName: z.string().min(2).max(120),
        line1: z.string().min(3).max(200),
        line2: z.string().max(200).optional(),
        city: z.string().min(2).max(100),
        state: z.string().min(2).max(100),
        postalCode: z.string().min(3).max(20),
        country: z.string().min(2).max(100),
    }),
});
export const OnboardingPayoutStepSchema = tokenField.extend({
    payoutMethod: z.enum(['bank', 'usdc']),
    makeDefaultPayout: z.boolean().default(true),
});
export const OnboardingPayoutDetailsStepSchema = tokenField.extend({
    devBypassPaystackVerify: z.literal(true).optional(),
    bankDetails: z
        .object({
        bankCode: z.string().min(2),
        accountNumber: z.string().regex(/^\d{10}$/),
    })
        .optional(),
    cryptoWalletAddress: z.string().min(10).max(120).optional(),
});
export const OnboardingIdentityStepSchema = tokenField.extend({
    skipIdentity: z.literal(true).optional(),
    identityVerification: z
        .object({
        documentType: z.enum([
            'international_passport',
            'drivers_license',
            'nin',
            'statement_of_account',
            'utility_bill',
        ]),
        nin: z.string().min(5).max(20).optional(),
        documentFileName: z.string().max(200).optional(),
        documentUrl: z.string().url().optional(),
    })
        .optional(),
}).refine((payload) => payload.skipIdentity === true || Boolean(payload.identityVerification), { message: 'Provide identity details or skip this step.' });
export const OnboardingVendorProfileStepSchema = z.object({
    onboardingToken: z.string().uuid(),
    categories: z.array(z.string().min(1)).min(1),
    subcategories: z.array(z.string().min(1)).min(1),
    businessStatus: z.enum(['registered', 'unregistered']),
    address: z.string().min(3).max(500),
    cacNumber: z.string().min(2).max(100).optional(),
});
export const OnboardingVendorBankStepSchema = z.object({
    onboardingToken: z.string().uuid(),
    bankDetails: z.object({
        bankCode: z.string().min(2),
        accountNumber: z.string().regex(/^\d{10}$/),
    }),
});
export const OnboardingCompleteSchema = z.object({
    onboardingToken: z.string().uuid(),
    tutorialCompleted: z.boolean().optional(),
});
