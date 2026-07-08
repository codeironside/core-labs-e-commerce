import crypto from 'crypto';
import { config } from '@core/config';
import { getRedisClient } from '@core/services/redis';
import { emailService } from '@core/services/email';
import { logger } from '@core/services/logger';
import { MESSAGES } from '@core/constants/messages';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
const normalizeEmail = (email) => email.trim().toLowerCase();
const normalizeOtp = (candidateOtp) => candidateOtp.replace(/\D/g, '');
function generateOtp() {
    const max = Math.pow(10, config.otp.length);
    const min = Math.pow(10, config.otp.length - 1);
    return String(crypto.randomInt(min, max));
}
function redisKey(email, purpose) {
    return `otp:${purpose}:${normalizeEmail(email)}`;
}
function resendCooldownKey(email, purpose) {
    return `otp:resend-cooldown:${purpose}:${normalizeEmail(email)}`;
}
const assertResendCooldown = async (email, purpose) => {
    const cooldownKey = resendCooldownKey(email, purpose);
    const remainingSeconds = await getRedisClient().ttl(cooldownKey);
    if (remainingSeconds > 0) {
        throw new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, `${MESSAGES.AUTH.OTP_RESEND_COOLDOWN} (${remainingSeconds}s)`);
    }
};
const markResendCooldown = async (email, purpose) => {
    await getRedisClient().setex(resendCooldownKey(email, purpose), config.otp.resendCooldownSeconds, '1');
};
const buildOtpEmail = (purpose, otp) => {
    const subject = purpose === 'password_reset'
        ? 'LedgerNode — Password reset code'
        : purpose === 'login_2fa'
            ? 'LedgerNode — Login verification code'
            : 'LedgerNode — Verify your email';
    const actionText = purpose === 'password_reset'
        ? 'reset your password'
        : purpose === 'login_2fa'
            ? 'complete your login'
            : 'verify your email address';
    const html = `
    <div style="font-family:'DM Sans',sans-serif;max-width:480px;margin:0 auto;padding:32px;">
      <h2 style="color:#1a1a1a;margin-bottom:8px;">Your verification code</h2>
      <p style="color:#6b7280;font-size:14px;">Use the code below to ${actionText}. It expires in ${Math.floor(config.otp.ttl / 60)} minutes.</p>
      <div style="background:#f5f5f5;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
        <span style="font-size:36px;letter-spacing:8px;font-weight:700;color:#1a1a1a;">${otp}</span>
      </div>
      <p style="color:#9ca3af;font-size:12px;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
    return { subject, html };
};
export async function createAndSendOtp(email, purpose, options) {
    const normalizedEmail = normalizeEmail(email);
    if (options?.enforceCooldown ?? false) {
        await assertResendCooldown(normalizedEmail, purpose);
    }
    const otp = generateOtp();
    const key = redisKey(normalizedEmail, purpose);
    if (config.env === 'development') {
        await getRedisClient().setex(key, config.otp.ttl, otp);
        console.log(`[DEV OTP] purpose=${purpose} email=${normalizedEmail} code=${otp} ttlSeconds=${config.otp.ttl}`);
        logger.info({ email: normalizedEmail, purpose, otp, ttlSeconds: config.otp.ttl }, '[DEV OTP] Email send skipped in development');
        if (options?.enforceCooldown ?? false) {
            await markResendCooldown(normalizedEmail, purpose);
        }
        return;
    }
    const { subject, html } = buildOtpEmail(purpose, otp);
    await emailService.send({ to: normalizedEmail, subject, html });
    await getRedisClient().setex(key, config.otp.ttl, otp);
    if (options?.enforceCooldown ?? false) {
        await markResendCooldown(normalizedEmail, purpose);
    }
    logger.info({ email: normalizedEmail, purpose }, MESSAGES.AUTH.OTP_SENT);
}
export async function verifyOtp(email, purpose, candidateOtp) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCandidate = normalizeOtp(candidateOtp);
    const key = redisKey(normalizedEmail, purpose);
    const stored = await getRedisClient().get(key);
    if (!stored || stored !== normalizedCandidate) {
        throw new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, MESSAGES.AUTH.OTP_INVALID);
    }
    await getRedisClient().del(key);
}
const passwordResetTokenKey = (email) => `password_reset_token:${normalizeEmail(email)}`;
export async function verifyPasswordResetOtpAndIssueToken(email, candidateOtp) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedCandidate = normalizeOtp(candidateOtp);
    const key = redisKey(normalizedEmail, 'password_reset');
    const stored = await getRedisClient().get(key);
    if (!stored || stored !== normalizedCandidate) {
        throw new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, MESSAGES.AUTH.OTP_INVALID);
    }
    await getRedisClient().del(key);
    const resetToken = crypto.randomUUID();
    await getRedisClient().setex(passwordResetTokenKey(normalizedEmail), 600, resetToken);
    return resetToken;
}
export async function consumePasswordResetToken(email, resetToken) {
    const normalizedEmail = normalizeEmail(email);
    const key = passwordResetTokenKey(normalizedEmail);
    const stored = await getRedisClient().get(key);
    if (!stored || stored !== resetToken) {
        throw new AppError(HTTP_STATUS.UNPROCESSABLE_ENTITY, MESSAGES.AUTH.OTP_INVALID);
    }
    await getRedisClient().del(key);
}
