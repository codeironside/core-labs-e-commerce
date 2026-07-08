import { listPaystackBanks } from '../listBanks';
import { HTTP_STATUS } from '@core/constants';
export const getOnboardingBanks = async (_req, res, next) => {
    try {
        const banks = await listPaystackBanks();
        res.status(HTTP_STATUS.OK).json({
            success: true,
            message: 'Banks retrieved.',
            data: banks,
        });
    }
    catch (error) {
        next(error);
    }
};
