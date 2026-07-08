import jwt from 'jsonwebtoken';
import { config } from '@core/config';
import { HTTP_STATUS } from '@core/constants';
import { MESSAGES } from '@core/constants/messages';
import { AppError } from '@core/middleware/errorHandler';
const ROLE_HIERARCHY = {
    super_admin: 5,
    admin: 4,
    editor: 3,
    member: 2,
    viewer: 1,
};
export function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
    }
    const token = header.replace('Bearer ', '');
    try {
        const payload = jwt.verify(token, config.jwt.accessSecret);
        req.user = payload;
        next();
    }
    catch {
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID));
    }
}
export function requireRole(minimumRole) {
    return (req, _res, next) => {
        const user = req.user;
        if (!user)
            return next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
        if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
            return next(new AppError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
        }
        next();
    };
}
