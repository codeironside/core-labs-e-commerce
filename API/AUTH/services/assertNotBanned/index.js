import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
export const assertUserNotPlatformBanned = (user) => {
    if (user.platformBanned) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, user.platformBanReason ?? 'This account has been suspended from the platform.');
    }
};
