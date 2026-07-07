import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';
import type { IUserDocument } from '@api/AUTH/models';

export const assertUserNotPlatformBanned = (user: IUserDocument): void => {
  if (user.platformBanned) {
    throw new AppError(
      HTTP_STATUS.FORBIDDEN,
      user.platformBanReason ?? 'This account has been suspended from the platform.',
    );
  }
};
