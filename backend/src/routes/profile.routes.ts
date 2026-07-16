import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { updateProfile, uploadAvatar } from "../controllers/profile.controller";

const router = Router();

router.put("/", requireAuth, updateProfile);
router.post("/avatar", requireAuth, upload.single("avatar"), uploadAvatar);

export default router;
