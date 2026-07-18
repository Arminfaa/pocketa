import type { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { BudgetModel } from "../models/Budget";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import { BudgetCreateSchema, BudgetQuerySchema, BudgetUpdateSchema } from "../validations/budgets";
import jalaali from "jalaali-js";

function getCurrentJalaliMonthYear(): { year: number; month: number } {
  const now = new Date();
  const { jy, jm } = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { year: jy, month: jm };
}

function datePrefix(year: number, month: number) {
  return `${year}/${String(month).padStart(2, "0")}/`;
}

function budgetStatus(percent: number): "ok" | "warning" | "danger" {
  if (percent >= 100) return "danger";
  if (percent >= 80) return "warning";
  return "ok";
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BudgetQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { page, limit, month, year, accountId } = parsed.data;
  const current = getCurrentJalaliMonthYear();
  const y = year ?? current.year;
  const m = month ?? current.month;

  const filter = { userId, month: m, year: y };
  const total = await BudgetModel.countDocuments(filter);

  const budgets = await BudgetModel.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate({ path: "categoryId", select: "name icon color type" });

  const prefix = datePrefix(y, m);
  const expenseMatch: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    type: "expense",
    date: { $regex: `^${prefix}` },
    source: { $nin: ["transfer", "balance_adjustment", "investment", "goal"] },
  };
  if (accountId) {
    expenseMatch.accountId = new mongoose.Types.ObjectId(accountId);
  }
  const expenseSums = await TransactionModel.aggregate([
    { $match: expenseMatch },
    { $group: { _id: "$categoryId", sum: { $sum: "$amount" } } },
  ]);

  const sumByCategory = new Map<string, number>();
  for (const row of expenseSums) {
    sumByCategory.set(String(row._id), row.sum);
  }

  const items = budgets.map((b) => {
    const categoryDoc = b.categoryId as unknown as {
      _id: mongoose.Types.ObjectId;
      name?: string;
      color?: string;
      icon?: string;
      type?: string;
    };
    const categoryId = categoryDoc?._id ? String(categoryDoc._id) : String(b.categoryId);
    const consumed = sumByCategory.get(categoryId) ?? 0;
    const rawPercent = b.amount > 0 ? (consumed / b.amount) * 100 : 0;
    const percent = Math.min(100, rawPercent);
    return {
      id: b._id,
      amount: b.amount,
      month: b.month,
      year: b.year,
      category: b.categoryId,
      consumed,
      percent,
      rawPercent,
      status: budgetStatus(rawPercent),
      remaining: Math.max(0, b.amount - consumed),
    };
  });

  const summary = {
    totalBudget: items.reduce((s, i) => s + i.amount, 0),
    totalConsumed: items.reduce((s, i) => s + i.consumed, 0),
    warningCount: items.filter((i) => i.status === "warning").length,
    dangerCount: items.filter((i) => i.status === "danger").length,
  };

  return sendSuccess(res, {
    items,
    pagination: { page, limit, total },
    month: m,
    year: y,
    summary,
  });
});

export const upsert = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BudgetCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { categoryId, amount, month, year } = parsed.data;

  const category = await CategoryModel.findOne({ _id: categoryId, userId });
  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  if (category.type !== "expense") {
    throw new AppError(400, "بودجه فقط برای دسته‌های هزینه قابل تنظیم است");
  }

  const updated = await BudgetModel.findOneAndUpdate(
    { userId, categoryId, month, year },
    { $set: { amount, categoryId, month, year, userId } },
    { returnDocument: "after", upsert: true }
  ).populate({ path: "categoryId", select: "name icon color type" });

  return sendSuccess(res, { item: updated }, "بودجه ذخیره شد");
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BudgetUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const budget = await BudgetModel.findOne({ _id: id, userId });
  if (!budget) throw new AppError(404, "بودجه یافت نشد");

  if (parsed.data.categoryId && parsed.data.categoryId !== String(budget.categoryId)) {
    const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
    if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
    if (category.type !== "expense") throw new AppError(400, "بودجه فقط برای دسته‌های هزینه است");
    budget.categoryId = new mongoose.Types.ObjectId(parsed.data.categoryId) as typeof budget.categoryId;
  }

  if (parsed.data.amount !== undefined) budget.amount = parsed.data.amount;
  if (parsed.data.month !== undefined) budget.month = parsed.data.month;
  if (parsed.data.year !== undefined) budget.year = parsed.data.year;

  await budget.save();
  const updated = await budget.populate({ path: "categoryId", select: "name icon color type" });

  return sendSuccess(res, { item: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await BudgetModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "بودجه یافت نشد");

  return sendSuccess(res, { id }, "بودجه حذف شد");
});
