import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  downloadBackup,
  getBackupJson,
  restoreBackup,
} from "../controllers/backup.controller";

const router = Router();

router.get("/download", requireAuth, downloadBackup);
router.get("/", requireAuth, getBackupJson);
router.post("/restore", requireAuth, restoreBackup);

export default router;
