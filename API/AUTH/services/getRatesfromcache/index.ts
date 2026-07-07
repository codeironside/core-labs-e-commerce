import { Request, Response,NextFunction } from "express";
import { getRatesFromCache } from "../../../../CORE/workers/exchange_rates";
import { HTTP_STATUS } from "../../../../CORE/constants";



export const getRatesfromcache = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rates = await getRatesFromCache();
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: {
          usdRate: Math.round(rates.usdRate * 100) / 100,
          solRate: Math.round(rates.solRate * 100) / 100,
          ethRate: Math.round(rates.ethRate * 100) / 100,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (err) { next(err); }
  }