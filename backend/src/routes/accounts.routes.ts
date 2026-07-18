import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  adjustBalance,
  create,
  getOne,
  list,
  remove,
  update,
} from "../controllers/accounts.controller";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.get("/:id", requireAuth, getOne);
router.post("/:id/adjust-balance", requireAuth, adjustBalance);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;
