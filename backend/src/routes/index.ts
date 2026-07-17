import { Router } from "express";
import authRoutes from "./auth.routes";
import transactionsRoutes from "./transactions.routes";
import categoriesRoutes from "./categories.routes";
import budgetsRoutes from "./budgets.routes";
import dashboardRoutes from "./dashboard.routes";
import reportsRoutes from "./reports.routes";
import profileRoutes from "./profile.routes";
import accountsRoutes from "./accounts.routes";
import importsRoutes from "./imports.routes";
import recurringRoutes from "./recurring.routes";
import goalsRoutes from "./goals.routes";
import pushRoutes from "./push.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/accounts", accountsRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/categories", categoriesRoutes);
router.use("/budgets", budgetsRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/reports", reportsRoutes);
router.use("/profile", profileRoutes);
router.use("/imports", importsRoutes);
router.use("/recurring", recurringRoutes);
router.use("/goals", goalsRoutes);
router.use("/push", pushRoutes);

export default router;

