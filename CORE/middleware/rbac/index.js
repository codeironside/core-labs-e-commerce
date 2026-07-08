import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { HTTP_STATUS } from '../../constants/index.js';
import { MESSAGES } from '../../constants/messages/index.js';
import { AppError } from '../errorHandler/index.js';
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
        next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
        return;
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
        if (!user) {
            next(new AppError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.UNAUTHORIZED));
            return;
        }
        if (ROLE_HIERARCHY[user.role] < ROLE_HIERARCHY[minimumRole]) {
            next(new AppError(HTTP_STATUS.FORBIDDEN, MESSAGES.AUTH.FORBIDDEN));
            return;
        }
        next();
    };
}
