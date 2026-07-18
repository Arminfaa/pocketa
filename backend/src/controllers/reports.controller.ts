import type { Request, Response } from "express";
import jalaali from "jalaali-js";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import { BankAccountModel } from "../models/BankAccount";
import {
  getActiveAccountIds,
  getNonOperatingCategoryIds,
} from "../services/accounting.service";

function currentJalaliMonthYear() {
  const now = new Date();
  const { jy, jm } = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return { year: jy, month: jm };
}

function prevMonthYear(year: number, month: number) {
  if (month > 1) return { year, month: month - 1 };
  return { year: year - 1, month: 12 };
}

function prefix(year: number, month: number) {
  return `${year}/${String(month).padStart(2, "0")}/`;
}

function parseAccountId(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value || undefined;
}

async function assertAccountOwned(userId: string, accountId?: string) {
  if (!accountId) return;
  const account = await BankAccountModel.findOne({ _id: accountId, userId });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
}

async function operatingScope(userId: string, accountId?: string) {
  const nonOp = await getNonOperatingCategoryIds(userId);
  const activeIds = await getActiveAccountIds(userId);
  const accountScope: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] } =
    accountId
      ? new mongoose.Types.ObjectId(accountId)
      : { $in: activeIds.length > 0 ? activeIds : [new mongoose.Types.ObjectId()] };

  const match: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    accountId: accountScope,
    source: { $nin: ["transfer", "balance_adjustment", "investment", "goal"] },
  };
  if (nonOp.length > 0) match.categoryId = { $nin: nonOp };
  return match;
}

async function sumByTypeAndMonth(
  userId: string,
  type: "income" | "expense",
  year: number,
  month: number,
  accountId?: string
) {
  const p = prefix(year, month);
  const base = await operatingScope(userId, accountId);
  const result = await TransactionModel.aggregate([
    {
      $match: {
        ...base,
        type,
        date: { $regex: `^${p}` },
      },
    },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]);
  return result[0]?.sum ?? 0;
}

export const monthly = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const accountId = parseAccountId(req.query.accountId);
  await assertAccountOwned(userId, accountId);

  const monthsCount = Number(req.query.months ?? 6);
  const n = Number.isFinite(monthsCount) ? Math.max(1, Math.min(12, monthsCount)) : 6;

  const current = currentJalaliMonthYear();
  const months: { year: number; month: number }[] = [];
  let y = current.year;
  let m = current.month;
  for (let i = 0; i < n; i++) {
    months.push({ year: y, month: m });
    const prev = prevMonthYear(y, m);
    y = prev.year;
    m = prev.month;
  }

  const data = await Promise.all(
    months.map(async (mm) => ({
      year: mm.year,
      month: mm.month,
      income: await sumByTypeAndMonth(userId, "income", mm.year, mm.month, accountId),
      expense: await sumByTypeAndMonth(userId, "expense", mm.year, mm.month, accountId),
    }))
  );

  const ordered = data.slice().reverse();
  const labels = ordered.map((d) => `${d.year}/${String(d.month).padStart(2, "0")}`);
  const income = ordered.map((d) => d.income);
  const expense = ordered.map((d) => d.expense);
  const net = ordered.map((d) => d.income - d.expense);

  const totalIncome = income.reduce((s, v) => s + v, 0);
  const totalExpense = expense.reduce((s, v) => s + v, 0);

  return sendSuccess(res, {
    accountId: accountId ?? null,
    labels,
    income,
    expense,
    net,
    summary: {
      totalIncome,
      totalExpense,
      totalNet: totalIncome - totalExpense,
      months: n,
    },
  });
});

export const categories = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const accountId = parseAccountId(req.query.accountId);
  await assertAccountOwned(userId, accountId);

  const current = currentJalaliMonthYear();
  const year = req.query.year ? Number(req.query.year) : current.year;
  const month = req.query.month ? Number(req.query.month) : current.month;
  const p = prefix(year, month);
  const matchBase = {
    ...(await operatingScope(userId, accountId)),
    date: { $regex: `^${p}` },
  };

  const [expenseRows, incomeRows, topExpenses] = await Promise.all([
    TransactionModel.aggregate([
      { $match: { ...matchBase, type: "expense" } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),
    TransactionModel.aggregate([
      { $match: { ...matchBase, type: "income" } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
      { $limit: 8 },
    ]),
    TransactionModel.find({
      ...matchBase,
      type: "expense",
    })
      .sort({ amount: -1 })
      .limit(8)
      .populate({ path: "categoryId", select: "name color" })
      .populate({ path: "accountId", select: "name bankName" })
      .select("title amount date categoryId accountId"),
  ]);

  const expenseIds = expenseRows
    .map((r: { _id: unknown }) => r._id)
    .filter(Boolean) as mongoose.Types.ObjectId[];
  const incomeIds = incomeRows
    .map((r: { _id: unknown }) => r._id)
    .filter(Boolean) as mongoose.Types.ObjectId[];

  const [expenseCats, incomeCats] = await Promise.all([
    CategoryModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      _id: { $in: expenseIds },
    }).select("name icon color"),
    CategoryModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      _id: { $in: incomeIds },
    }).select("name icon color"),
  ]);

  const expenseMap = new Map(expenseCats.map((c) => [String(c._id), c]));
  const incomeMap = new Map(incomeCats.map((c) => [String(c._id), c]));

  const expense = expenseRows.map((r: { _id: unknown; amount?: number }) => ({
    categoryId: String(r._id),
    name: expenseMap.get(String(r._id))?.name ?? "نامشخص",
    color: expenseMap.get(String(r._id))?.color ?? "#ef4444",
    amount: r.amount ?? 0,
  }));

  const income = incomeRows.map((r: { _id: unknown; amount?: number }) => ({
    categoryId: String(r._id),
    name: incomeMap.get(String(r._id))?.name ?? "نامشخص",
    color: incomeMap.get(String(r._id))?.color ?? "#22c55e",
    amount: r.amount ?? 0,
  }));

  const expenseTotal = expense.reduce((s, i) => s + i.amount, 0);
  const incomeTotal = income.reduce((s, i) => s + i.amount, 0);

  return sendSuccess(res, {
    accountId: accountId ?? null,
    month,
    year,
    expense,
    income,
    expenseTotal,
    incomeTotal,
    topExpenses: topExpenses.map((tx) => ({
      id: tx._id,
      title: tx.title,
      amount: tx.amount,
      date: tx.date,
      category:
        typeof tx.categoryId === "object" && tx.categoryId && "name" in tx.categoryId
          ? (tx.categoryId as { name?: string }).name
          : "—",
      account:
        typeof tx.accountId === "object" && tx.accountId && "name" in tx.accountId
          ? (tx.accountId as { name?: string }).name
          : "—",
    })),
  });
});
