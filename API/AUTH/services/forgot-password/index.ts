import { Request, Response, NextFunction } from 'express';
import { ForgotPasswordSchema } from '@api/AUTH/schemas';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { createAndSendOtp } from '../otp';
import { publishKafkaEvent } from '@core/services/kafka';
import { KAFKA_TOPICS } from '@core/constants/kafka';
import { findUserByEmail } from '@core/services/db/userLookup';

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = ForgotPasswordSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    await createAndSendOtp(email, 'password_reset');

    await publishKafkaEvent(
      KAFKA_TOPICS.USER_FORGOT_PASSWORD,
      { userId: String(user._id), email },
      String(user._id),
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.OTP_SENT,
    });
  } catch (err) {
    next(err);
  }
};
