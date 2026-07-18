import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { SavingsGoalModel } from "../models/SavingsGoal";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";
import { GoalContributeSchema, GoalCreateSchema, GoalUpdateSchema } from "../validations/goals";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import { todayJalali } from "../utils/jalaliDate";
import {
  ensureNamedCategory,
  GOAL_CONTRIBUTION_CATEGORY_NAME,
} from "../services/accounting.service";

function mapGoal(goal: {
  _id: unknown;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string | null;
  color: string;
  icon: string;
  active: boolean;
  notes?: string | null;
}) {
  const percent =
    goal.targetAmount > 0
      ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
      : 0;
  return {
    id: goal._id,
    title: goal.title,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remaining: Math.max(0, goal.targetAmount - goal.currentAmount),
    deadline: goal.deadline ?? "",
    color: goal.color,
    icon: goal.icon,
    active: goal.active,
    notes: goal.notes ?? "",
    percent,
    completed: goal.currentAmount >= goal.targetAmount,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const includeInactive = String(req.query.includeInactive ?? "") === "true";
  const filter: Record<string, unknown> = { userId };
  if (!includeInactive) filter.active = true;

  const goals = await SavingsGoalModel.find(filter).sort({ createdAt: -1 });
  const items = goals.map(mapGoal);

  return sendSuccess(res, {
    items,
    summary: {
      totalTarget: items.reduce((s, i) => s + i.targetAmount, 0),
      totalSaved: items.reduce((s, i) => s + i.currentAmount, 0),
      completedCount: items.filter((i) => i.completed).length,
    },
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = GoalCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const deadline =
    parsed.data.deadline && parsed.data.deadline !== ""
      ? normalizeJalaliDate(parsed.data.deadline)
      : "";

  const goal = await SavingsGoalModel.create({
    userId,
    title: parsed.data.title,
    targetAmount: parsed.data.targetAmount,
    currentAmount: 0,
    deadline,
    color: parsed.data.color,
    icon: parsed.data.icon,
    notes: parsed.data.notes ?? "",
    active: true,
  });

  // Optional opening progress must come via contribute (cash-linked)
  if ((parsed.data.currentAmount ?? 0) > 0) {
    // Keep create simple — ignore initial currentAmount unless 0
  }

  return sendSuccess(res, { item: mapGoal(goal) }, "هدف پس‌انداز ایجاد شد", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = GoalUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  // Do not allow silent currentAmount edits — progress must go through contribute
  const { currentAmount: _ignored, ...rest } = parsed.data;
  const next: Record<string, unknown> = { ...rest };
  if (parsed.data.deadline !== undefined) {
    next.deadline =
      parsed.data.deadline && parsed.data.deadline !== ""
        ? normalizeJalaliDate(parsed.data.deadline)
        : "";
  }
  if (parsed.data.notes !== undefined) next.notes = parsed.data.notes ?? "";

  const goal = await SavingsGoalModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: next },
    { returnDocument: "after" }
  );
  if (!goal) throw new AppError(404, "هدف یافت نشد");

  return sendSuccess(res, { item: mapGoal(goal) });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await SavingsGoalModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "هدف یافت نشد");

  return sendSuccess(res, { id }, "هدف حذف شد");
});

export const contribute = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = GoalContributeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const goal = await SavingsGoalModel.findOne({ _id: id, userId, active: true });
  if (!goal) throw new AppError(404, "هدف فعال یافت نشد");

  const account = await BankAccountModel.findOne({
    _id: parsed.data.accountId,
    userId,
    isActive: true,
  });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const room = Math.max(0, goal.targetAmount - goal.currentAmount);
  const amount = Math.min(parsed.data.amount, room);
  if (amount <= 0) {
    throw new AppError(400, "این هدف تکمیل شده است");
  }

  const category = await ensureNamedCategory(
    userId,
    GOAL_CONTRIBUTION_CATEGORY_NAME,
    "expense",
    "Target",
    "#14b8a6"
  );
  const date = parsed.data.date
    ? normalizeJalaliDate(parsed.data.date)
    : todayJalali();

  await TransactionModel.create({
    userId,
    accountId: account._id,
    type: "expense",
    amount,
    categoryId: category._id,
    title: `پس‌انداز — ${goal.title}`,
    description: "واریز به هدف پس‌انداز",
    date,
    tags: ["هدف-پس‌انداز"],
    source: "goal",
    needsReview: false,
    goalId: goal._id,
  });

  goal.currentAmount = goal.currentAmount + amount;
  await goal.save();

  return sendSuccess(
    res,
    { item: mapGoal(goal) },
    `مبلغ ${Math.round(amount).toLocaleString("en-US")} تومان از حساب کم و به هدف اضافه شد`
  );
});
