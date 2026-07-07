import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import { resolveNigerianBankAccount } from '@core/services/paystack';

const resolveBankQuerySchema = z.object({
  bankCode: z.string().min(2),
  accountNumber: z.string().min(10).max(10),
});

export const resolveOnboardingBankAccount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = resolveBankQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, parsed.error.issues[0]?.message ?? 'Invalid bank details.');
    }

    const resolved = await resolveNigerianBankAccount(
      parsed.data.bankCode,
      parsed.data.accountNumber,
    );

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Bank account resolved.',
      data: {
        accountName: resolved.account_name,
        accountNumber: resolved.account_number,
      },
    });
  } catch (error) {
    next(error);
  }
};
