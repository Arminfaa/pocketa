import { Router } from "express";
import { categories, monthly } from "../controllers/reports.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/monthly", requireAuth, monthly);
router.get("/categories", requireAuth, categories);

export default router;

