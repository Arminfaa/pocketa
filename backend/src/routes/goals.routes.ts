import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { contribute, create, list, remove, update } from "../controllers/goals.controller";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);
router.post("/:id/contribute", requireAuth, contribute);

export default router;
