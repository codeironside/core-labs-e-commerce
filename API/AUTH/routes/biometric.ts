import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, AuthenticatedRequest } from '@core/middleware/rbac';
import { UserModel } from '@api/USERS/model';
import { loginByUserId } from '@api/AUTH/services/login';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import { logger } from '@core/services/logger';
import { findUserByEmail } from '@core/services/db/userLookup';

export const biometricRouter = Router();

/**
 * POST /auth/biometric/register
 * Authenticated: stores a public key on the user document.
 * The mobile app generates a key pair after enrolling fingerprint/face,
 * and sends the public key here.
 */
biometricRouter.post('/register', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const { publicKey } = req.body as { publicKey: string };

    if (!publicKey || publicKey.length < 20) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'A valid public key is required.');
    }

    await UserModel.findByIdAndUpdate(userId, { biometricPublicKey: publicKey });
    logger.info({ userId }, 'Biometric public key registered');

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Biometric authentication registered.' });
  } catch (err) { next(err); }
});

/**
 * POST /auth/biometric/challenge
 * Public: returns a random challenge for the mobile app to sign.
 */
biometricRouter.post('/challenge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email is required.');

    const user = await findUserByEmail(email);
    if (!user || !user.biometricPublicKey) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Biometric authentication not set up for this account.');
    }

    const challenge = crypto.randomBytes(32).toString('base64');

    // Store challenge temporarily (5 minutes)
    const { getRedisClient } = await import('@core/services/redis');
    await getRedisClient().setex(`biometric:challenge:${email}`, 300, challenge);

    res.status(HTTP_STATUS.OK).json({ success: true, data: { challenge } });
  } catch (err) { next(err); }
});

/**
 * POST /auth/biometric/login
 * Public: verifies the signed challenge against the stored public key.
 * Returns a TokenPair if valid.
 */
biometricRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, signature } = req.body as { email: string; signature: string };
    if (!email || !signature) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Email and signature are required.');
    }

    const user = await findUserByEmail(email);
    if (!user || !user.biometricPublicKey) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Biometric authentication not available.');
    }

    // Retrieve stored challenge
    const { getRedisClient } = await import('@core/services/redis');
    const challenge = await getRedisClient().get(`biometric:challenge:${email}`);
    if (!challenge) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Challenge expired. Please request a new one.');
    }

    // Verify signature
    const verifier = crypto.createVerify('SHA256');
    verifier.update(challenge);
    const isValid = verifier.verify(user.biometricPublicKey, signature, 'base64');

    if (!isValid) {
      throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Biometric verification failed.');
    }

    // Clean up challenge
    await getRedisClient().del(`biometric:challenge:${email}`);

    const tokens = await loginByUserId(String(user._id));
    logger.info({ userId: String(user._id) }, 'Biometric login successful');

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Biometric login successful.', data: tokens });
  } catch (err) { next(err); }
});
