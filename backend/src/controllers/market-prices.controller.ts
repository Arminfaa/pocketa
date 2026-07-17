import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { getMarketPrices } from "../services/market-prices.service";

export const getMarketPricesHandler = asyncHandler(async (_req: Request, res: Response) => {
  const prices = await getMarketPrices();
  // Client may cache briefly; server also keeps a 30s memory cache
  res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return sendSuccess(res, prices);
});
