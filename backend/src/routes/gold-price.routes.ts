import { Router } from "express";
import { show } from "../controllers/gold-price.controller";

const router = Router();

/** Public live gold prices (gram & mesghal, 24k/18k in Toman). */
router.get("/", show);

export default router;
