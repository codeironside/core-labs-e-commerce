import { Request, Response, NextFunction } from 'express';
import { logoutUser } from '../login';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    await logoutUser(refreshToken);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: MESSAGES.AUTH.LOGOUT_SUCCESS,
    });
  } catch (err) {
    next(err);
  }
};
