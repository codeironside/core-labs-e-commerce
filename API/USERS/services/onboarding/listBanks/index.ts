import { listNigerianBanks, type PaystackBankOption } from '@core/services/paystack';

export type { PaystackBankOption };

export const listPaystackBanks = async (): Promise<PaystackBankOption[]> => listNigerianBanks();
