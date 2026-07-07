import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '@core/middleware/rbac';
import { UserModel } from '@api/USERS/model';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';
import { AvatarMetadataSchema, UpdateProfileSchema, UpdatePushTokenSchema } from '@api/USERS/schemas';
import { onboardingRouter } from './onboarding';
import { findUserById } from '@core/services/db/userLookup';

export const usersRouter = Router();

usersRouter.use('/onboarding', onboardingRouter);

usersRouter.use(authenticate);

usersRouter.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const userDoc = await findUserById(userId, { select: '-passwordHash' });
    if (!userDoc) throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    const user = userDoc.toObject();
    
    user.profileImage = user.profileImage || user.avatarUrl;
    res.status(HTTP_STATUS.OK).json({ success: true, message: MESSAGES.USER.FETCHED, data: user });
  } catch (err) { next(err); }
});

usersRouter.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const updates = UpdateProfileSchema.parse(req.body);

    const user = await UserModel.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select('-passwordHash');
    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);

    res.status(HTTP_STATUS.OK).json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (err) { next(err); }
});

usersRouter.post('/me/avatar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const metadata = AvatarMetadataSchema.parse(req.body);

    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        profileImage: metadata.profileImage,
        cloudinaryPublicId: metadata.cloudinaryPublicId,
      },
      { new: true },
    ).select('-passwordHash');

    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);

    res.status(HTTP_STATUS.OK).json({ success: true, message: MESSAGES.USER.AVATAR_UPLOADED, data: user });
  } catch (err) { next(err); }
});

usersRouter.put('/me/push-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const payload = UpdatePushTokenSchema.parse(req.body);

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { fcmToken: payload.fcmToken } },
      { new: true },
    ).select('-passwordHash +fcmToken');

    if (!user) throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Push token registered.',
      data: { registered: true, platform: payload.platform ?? null },
    });
  } catch (err) { next(err); }
});

usersRouter.delete('/me/push-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = (req as AuthenticatedRequest).user;

    await UserModel.findByIdAndUpdate(userId, { $unset: { fcmToken: 1 } });

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Push token removed.',
      data: { registered: false },
    });
  } catch (err) { next(err); }
});
