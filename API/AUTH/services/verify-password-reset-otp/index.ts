import { Request, Response, NextFunction } from 'express';
import { VerifyPasswordResetOtpSchema } from '@api/AUTH/schemas';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { findUserByEmail } from '@core/services/db/userLookup';
import { AppError } from '@core/middleware/errorHandler';
import { verifyPasswordResetOtpAndIssueToken } from '../otp';

export const verifyPasswordResetOtp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { email, otp } = VerifyPasswordResetOtpSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, MESSAGES.USER.NOT_FOUND);
    }

    const resetToken = await verifyPasswordResetOtpAndIssueToken(email, otp);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.OTP_VERIFIED,
      data: { resetToken },
    });
  } catch (err) {
    next(err);
  }
};
