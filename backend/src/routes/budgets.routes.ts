import { Router } from "express";
import { list, upsert, update, remove } from "../controllers/budgets.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, upsert);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;

