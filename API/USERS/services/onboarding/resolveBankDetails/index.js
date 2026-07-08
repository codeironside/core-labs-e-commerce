import { config } from '@core/config';
import { AppError } from '@core/middleware/errorHandler';
import { HTTP_STATUS } from '@core/constants';
import { findBankNameByCode, resolveNigerianBankAccount, } from '@core/services/paystack';
const accountNameMatchesHolder = (accountName, accountHolderName) => {
    const resolvedName = accountName.toLowerCase();
    const holderParts = accountHolderName
        .toLowerCase()
        .split(/\s+/)
        .filter((part) => part.length > 2);
    return holderParts.length > 0 && holderParts.every((part) => resolvedName.includes(part));
};
export const buildDevBypassBankDetails = async (bankDetails, accountHolderName) => {
    const accountName = accountHolderName.trim();
    if (!accountName) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Legal name from the address step is required for dev bypass.');
    }
    const bankName = await findBankNameByCode(bankDetails.bankCode);
    return {
        bankCode: bankDetails.bankCode,
        accountNumber: bankDetails.accountNumber.replace(/\D/g, ''),
        accountName,
        bankName,
    };
};
export const resolveVendorBankDetails = async (bankDetails, accountHolderName) => {
    const resolved = await resolveNigerianBankAccount(bankDetails.bankCode, bankDetails.accountNumber);
    const accountName = resolved.account_name.trim();
    if (!accountName) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Unable to verify bank account details.');
    }
    if (config.env !== 'development' && !accountNameMatchesHolder(accountName, accountHolderName)) {
        throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Bank account name does not match the legal name on your profile. Use the same full name from the address step.');
    }
    const bankName = await findBankNameByCode(bankDetails.bankCode);
    return {
        bankCode: bankDetails.bankCode,
        accountNumber: bankDetails.accountNumber.replace(/\D/g, ''),
        accountName,
        bankName,
    };
};
