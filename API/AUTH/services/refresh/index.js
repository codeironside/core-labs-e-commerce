import { RefreshTokenSchema } from '@api/AUTH/schemas';
import { refreshTokens } from '../login';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
export const refresh = async (req, res, next) => {
    try {
        const payload = RefreshTokenSchema.parse(req.body);
        const tokens = await refreshTokens(payload);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.AUTH.TOKEN_REFRESHED,
            data: tokens,
        });
    }
    catch (err) {
        next(err);
    }
};
