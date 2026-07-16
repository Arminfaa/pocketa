import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { create, getOne, list, remove, syncBalance, update } from "../controllers/accounts.controller";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.get("/:id", requireAuth, getOne);
router.post("/:id/sync-balance", requireAuth, syncBalance);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;
