import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { create, generate, list, remove, update } from "../controllers/recurring.controller";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);
router.post("/:id/generate", requireAuth, generate);

export default router;
