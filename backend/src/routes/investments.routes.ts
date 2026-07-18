import { Router } from "express";
import { create, list, remove, sell, update } from "../controllers/investments.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.post("/:id/sell", requireAuth, sell);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;
