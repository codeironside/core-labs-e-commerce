import { Request, Response, NextFunction } from 'express';
import { ResetPasswordSchema } from '@api/AUTH/schemas';
import { consumePasswordResetToken } from '../otp';
import { UserModel } from '@api/USERS/model';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';
import bcrypt from 'bcryptjs';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { findUserByEmail } from '@core/services/db/userLookup';

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, resetToken, newPassword } = ResetPasswordSchema.parse(req.body);
    await consumePasswordResetToken(email, resetToken);

    const user = await findUserByEmail(email);
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await UserModel.findOneAndUpdate({ email }, { passwordHash });

    await publishKafkaEvent(
      KAFKA_TOPICS.USER_RESET_PASSWORD,
      { userId: String(user._id), email },
      String(user._id),
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.PASSWORD_RESET,
    });
  } catch (err) {
    next(err);
  }
};
