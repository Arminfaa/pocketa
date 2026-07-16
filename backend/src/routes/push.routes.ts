import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { status, subscribe, unsubscribe, vapidPublicKey } from "../controllers/push.controller";

const router = Router();

router.get("/vapid-public-key", vapidPublicKey);
router.get("/status", requireAuth, status);
router.post("/subscribe", requireAuth, subscribe);
router.post("/unsubscribe", requireAuth, unsubscribe);

export default router;
