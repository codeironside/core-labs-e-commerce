import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  }),
  role: z.enum(['member', 'editor', 'vendor', 'admin', 'super_admin']).default('member').optional(),
  rememberMe: z.boolean().default(false),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().default(false),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const OAuthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email(),
  resetToken: z.string().uuid(),
  newPassword: z.string().min(8).regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^a-zA-Z0-9])/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  }),
});

export const VerifyPasswordResetOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const OAuthSignupRoleSchema = z.enum(['member', 'editor', 'vendor']);

export const CompleteOAuthSignupSchema = z.object({
  oauthPendingToken: z.string().uuid(),
  signupRole: OAuthSignupRoleSchema,
});

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  rememberMe: z.boolean().default(false).optional(),
});

export const ResendOtpSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(['email_verification', 'password_reset', 'login_2fa']),
});

export const PrivyLoginSchema = z.object({
  privyAccessToken: z.string().min(1).optional(),
  rememberMe: z.boolean().default(false).optional(),
  signupRole: z.enum(['member', 'editor', 'vendor', 'admin', 'super_admin']).optional(),
});

export type RegisterPayload = z.infer<typeof RegisterSchema>;
export type SignupRole = NonNullable<RegisterPayload['role']>;
export type LoginPayload = z.infer<typeof LoginSchema>;
export type RefreshTokenPayload = z.infer<typeof RefreshTokenSchema>;
export type ForgotPasswordPayload = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordPayload = z.infer<typeof ResetPasswordSchema>;
export type VerifyPasswordResetOtpPayload = z.infer<typeof VerifyPasswordResetOtpSchema>;
export type VerifyEmailPayload = z.infer<typeof VerifyEmailSchema>;
export type ResendOtpPayload = z.infer<typeof ResendOtpSchema>;
export type CompleteOAuthSignupPayload = z.infer<typeof CompleteOAuthSignupSchema>;
