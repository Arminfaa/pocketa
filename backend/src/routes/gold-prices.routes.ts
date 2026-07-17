import { Router } from "express";
import { getGoldPricesHandler } from "../controllers/gold-prices.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, getGoldPricesHandler);

export default router;
