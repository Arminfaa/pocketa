import { Router } from "express";
import {
  bulkRemove,
  create,
  list,
  remove,
  transfer,
  update,
} from "../controllers/transactions.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.post("/transfer", requireAuth, transfer);
router.post("/bulk-delete", requireAuth, bulkRemove);
router.put("/:id", requireAuth, update);
router.delete("/:id", requireAuth, remove);

export default router;
