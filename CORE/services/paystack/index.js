import { config } from '@core/config';
import { HTTP_STATUS } from '@core/constants';
import { AppError } from '@core/middleware/errorHandler';
import { logger } from '@core/services/logger';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const BANKS_PER_PAGE = 100;
const MAX_BANK_PAGES = 10;
const PAYSTACK_TEST_BANK_CODES = new Set(['999991', '999992', '001']);
const RESOLVE_CACHE_TTL_MS = 30 * 60 * 1000;
const resolveCache = new Map();
const isLivePaystackKey = () => config.paystack.secretKey.trim().startsWith('sk_live_');
const paystackHeaders = () => {
    const secretKey = config.paystack.secretKey.trim();
    if (!secretKey) {
        throw new AppError(HTTP_STATUS.SERVICE_UNAVAILABLE, 'Paystack is not configured for bank lookups.');
    }
    return {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
    };
};
const mapPaystackFailureStatus = (message, httpStatus) => {
    const normalized = message.toLowerCase();
    if (normalized.includes('daily limit') || normalized.includes('rate limit')) {
        return HTTP_STATUS.TOO_MANY_REQUESTS;
    }
    if (httpStatus === 401 || normalized.includes('invalid key') || normalized.includes('unauthorized')) {
        return HTTP_STATUS.SERVICE_UNAVAILABLE;
    }
    if (httpStatus >= 500) {
        return HTTP_STATUS.BAD_GATEWAY;
    }
    return HTTP_STATUS.BAD_REQUEST;
};
const paystackGet = async (path) => {
    let response;
    let rawText;
    try {
        response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
            method: 'GET',
            headers: paystackHeaders(),
        });
        rawText = await response.text();
    }
    catch (error) {
        logger.warn({ error, path }, 'Paystack network request failed');
        throw new AppError(HTTP_STATUS.BAD_GATEWAY, 'Could not reach Paystack. Try again in a moment.');
    }
    let envelope;
    try {
        envelope = JSON.parse(rawText);
    }
    catch {
        logger.warn({ path, rawText: rawText.slice(0, 240) }, 'Paystack returned non-JSON response');
        throw new AppError(HTTP_STATUS.BAD_GATEWAY, 'Invalid response from Paystack.');
    }
    if (!envelope.status) {
        const message = envelope.message || 'Bank verification failed.';
        const statusCode = mapPaystackFailureStatus(message, response.status);
        logger.warn({ path, message, httpStatus: response.status, statusCode }, 'Paystack rejected bank request');
        throw new AppError(statusCode, message);
    }
    if (!response.ok) {
        const message = envelope.message || 'Paystack bank lookup failed.';
        throw new AppError(mapPaystackFailureStatus(message, response.status), message);
    }
    return envelope.data;
};
const dedupeBanksByCode = (banks) => {
    const seenCodes = new Set();
    const uniqueBanks = [];
    banks.forEach((bank) => {
        const normalizedCode = bank.code.trim();
        if (!normalizedCode || seenCodes.has(normalizedCode)) {
            return;
        }
        seenCodes.add(normalizedCode);
        uniqueBanks.push({ code: normalizedCode, name: bank.name.trim() });
    });
    return uniqueBanks;
};
export const listNigerianBanks = async () => {
    const banks = [];
    for (let page = 1; page <= MAX_BANK_PAGES; page += 1) {
        const pageBanks = await paystackGet(`/bank?country=nigeria&perPage=${BANKS_PER_PAGE}&page=${page}`);
        banks.push(...pageBanks.map((bank) => ({
            code: bank.code,
            name: bank.name,
        })));
        if (pageBanks.length < BANKS_PER_PAGE) {
            break;
        }
    }
    return dedupeBanksByCode(banks)
        .filter((bank) => (isLivePaystackKey() ? !PAYSTACK_TEST_BANK_CODES.has(bank.code) : true))
        .sort((left, right) => left.name.localeCompare(right.name));
};
export const resolveNigerianBankAccount = async (bankCode, accountNumber) => {
    const normalizedAccountNumber = accountNumber.replace(/\D/g, '');
    if (normalizedAccountNumber.length !== 10) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Account number must be 10 digits.');
    }
    if (!bankCode.trim()) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Bank is required.');
    }
    const cacheKey = `${bankCode.trim()}:${normalizedAccountNumber}`;
    const cached = resolveCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }
    const resolved = await paystackGet(`/bank/resolve?account_number=${encodeURIComponent(normalizedAccountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    resolveCache.set(cacheKey, {
        expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS,
        data: resolved,
    });
    return resolved;
};
export const findBankNameByCode = async (bankCode) => {
    const banks = await listNigerianBanks();
    return banks.find((bank) => bank.code === bankCode)?.name ?? '';
};
