import { Router } from "express";
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
  register,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, changePassword);
router.post("/refresh", refresh);

export default router;

