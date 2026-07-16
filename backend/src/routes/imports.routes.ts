import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { confirm, preview } from "../controllers/imports.controller";

const router = Router();

router.post("/bank-sms/preview", requireAuth, preview);
router.post("/bank-sms/confirm", requireAuth, confirm);

export default router;
