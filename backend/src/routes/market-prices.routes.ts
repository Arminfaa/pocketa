import { Router } from "express";
import { getMarketPricesHandler } from "../controllers/market-prices.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, getMarketPricesHandler);

export default router;
