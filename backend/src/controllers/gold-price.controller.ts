import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { getGoldPrices } from "../services/gold-price.service";

export const show = asyncHandler(async (_req: Request, res: Response) => {
  const prices = await getGoldPrices();
  return sendSuccess(res, prices);
});
