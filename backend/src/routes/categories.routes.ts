import { Router } from "express";
import { create, list, remove, suggest, update } from "../controllers/categories.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, list);
router.get("/suggest", requireAuth, suggest);
router.post("/", requireAuth, create);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;

