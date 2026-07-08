import { config } from '@core/config';
import { logger } from '@core/logger';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
const isPremblyConfigured = () => Boolean(config.prembly.apiKey);
const premblyHeaders = () => ({
    'Content-Type': 'application/json',
    'x-api-key': config.prembly.apiKey,
});
const assertPremblySuccess = (payload, fallback) => {
    if (!payload.status && payload.response_code !== '00') {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, payload.detail ?? fallback);
    }
};
export const verifyNinWithPrembly = async (nin) => {
    if (!isPremblyConfigured()) {
        if (config.env === 'development') {
            logger.warn('[Prembly] Skipping NIN verification in development — credentials not configured');
            return { firstName: 'Dev', lastName: 'User' };
        }
        throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'NIN verification is temporarily unavailable.');
    }
    const res = await fetch(`${config.prembly.baseUrl}/verification/nin-level-2`, {
        method: 'POST',
        headers: premblyHeaders(),
        body: JSON.stringify({ number: nin }),
    });
    const payload = (await res.json().catch(() => ({})));
    if (!res.ok) {
        logger.error({ status: res.status, payload }, '[Prembly] NIN verification failed');
        throw new AppError(HTTP_STATUS.BAD_REQUEST, payload.detail ?? 'NIN verification failed.');
    }
    assertPremblySuccess(payload, 'NIN verification failed.');
    const ninData = payload.nin_data;
    if (!ninData?.firstname || !ninData.surname) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'NIN verification returned incomplete identity data.');
    }
    return {
        firstName: ninData.firstname,
        lastName: ninData.surname,
        middleName: ninData.middlename,
        phoneNumber: ninData.telephoneno,
    };
};
export const verifyBankAccountWithPrembly = async (input) => {
    if (!isPremblyConfigured()) {
        throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Bank verification is temporarily unavailable.');
    }
    const res = await fetch(`${config.prembly.baseUrl}/verification/bank_account/comparism`, {
        method: 'POST',
        headers: premblyHeaders(),
        body: JSON.stringify({
            number: input.accountNumber,
            bank_code: input.bankCode,
            customer: input.accountHolderName,
        }),
    });
    const payload = (await res.json().catch(() => ({})));
    if (!res.ok) {
        logger.error({ status: res.status, payload }, '[Prembly] Bank comparism failed');
        throw new AppError(HTTP_STATUS.BAD_REQUEST, payload.detail ?? 'Bank account verification failed.');
    }
    assertPremblySuccess(payload, 'Bank account verification failed.');
    const accountName = payload.account_data?.account_name?.trim();
    if (!accountName) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Bank account could not be resolved.');
    }
    const nameMatched = payload.comparism_data?.status === true
        || (payload.comparism_data?.confidence ?? 0) >= 0.6;
    if (!nameMatched) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Bank account name does not match your registered name.');
    }
    return { accountName, nameMatched };
};
export const resolveBankAccountBasicPrembly = async (bankCode, accountNumber) => {
    const res = await fetch(`${config.prembly.baseUrl}/verification/bank_account/basic`, {
        method: 'POST',
        headers: premblyHeaders(),
        body: JSON.stringify({ number: accountNumber, bank_code: bankCode }),
    });
    const payload = (await res.json().catch(() => ({})));
    if (!res.ok) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, payload.detail ?? 'Bank account verification failed.');
    }
    assertPremblySuccess(payload, 'Bank account verification failed.');
    const accountName = payload.account_data?.account_name ?? payload['account data']?.account_name;
    if (!accountName) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Bank account could not be resolved.');
    }
    return accountName.trim();
};
