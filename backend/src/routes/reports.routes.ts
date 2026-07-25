import { Router } from "express";
import { categories, debts, monthly } from "../controllers/reports.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/monthly", requireAuth, monthly);
router.get("/categories", requireAuth, categories);
router.get("/debts", requireAuth, debts);

export default router;

