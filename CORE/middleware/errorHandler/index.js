import { ZodError } from 'zod';
import { HTTP_STATUS } from '../../constants/index.js';
import { MESSAGES } from '../../constants/messages/index.js';
import { logger } from '../../services/logger/index.js';
export class AppError extends Error {
    statusCode;
    message;
    code;
    constructor(statusCode, message, code) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.name = 'AppError';
    }
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        const detailMessage = firstIssue
            ? `${firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : ''}${firstIssue.message}`
            : MESSAGES.GENERAL.VALIDATION_ERROR;
        res.status(HTTP_STATUS.UNPROCESSABLE_ENTITY).json({
            success: false,
            message: detailMessage,
            errors: err.flatten().fieldErrors,
        });
        return;
    }
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
        });
        return;
    }
    logger.error({ err }, 'Unhandled error');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: MESSAGES.GENERAL.INTERNAL_ERROR,
    });
}
