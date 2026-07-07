import { getPublicPlatformSignupSettings } from '@api/ADMIN/services/platform_settings';
import { Request, Response, NextFunction } from 'express';
import { HTTP_STATUS } from '@core/constants';

export const getSignupSettings = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const settings = await getPublicPlatformSignupSettings();

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'Signup settings',
      data: settings,
    });
  } catch (err) {
    next(err);
  }
};
