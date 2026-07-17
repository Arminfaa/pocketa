import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { getMarketPrices } from "../services/market-prices.service";

export const getMarketPricesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const prices = await getMarketPrices();
  return sendSuccess(res, prices);
});
