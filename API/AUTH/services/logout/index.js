import { logoutUser } from '../login';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
export const logout = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        await logoutUser(refreshToken);
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: MESSAGES.AUTH.LOGOUT_SUCCESS,
        });
    }
    catch (err) {
        next(err);
    }
};
