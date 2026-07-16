import type { Request, Response } from "express";
import jalaali from "jalaali-js";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";

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

async function sumByTypeAndMonth(userId: string, type: "income" | "expense", year: number, month: number) {
  const p = prefix(year, month);
  const result = await TransactionModel.aggregate([
    { $match: { userId, type, date: { $regex: `^${p}` } } },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]);
  return result[0]?.sum ?? 0;
}

export const monthly = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const monthsCount = Number(req.query.months ?? 6);
  const n = Number.isFinite(monthsCount) ? Math.max(3, Math.min(12, monthsCount)) : 6;

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
      income: await sumByTypeAndMonth(userId, "income", mm.year, mm.month),
      expense: await sumByTypeAndMonth(userId, "expense", mm.year, mm.month),
    }))
  );

  const labels = data
    .slice()
    .reverse()
    .map((d) => `${d.year}/${String(d.month).padStart(2, "0")}`);

  const income = data
    .slice()
    .reverse()
    .map((d) => d.income);

  const expense = data
    .slice()
    .reverse()
    .map((d) => d.expense);

  return sendSuccess(res, { labels, income, expense });
});

export const categories = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const current = currentJalaliMonthYear();
  const year = req.query.year ? Number(req.query.year) : current.year;
  const month = req.query.month ? Number(req.query.month) : current.month;
  const p = prefix(year, month);

  const [expenseRows, incomeRows] = await Promise.all([
    TransactionModel.aggregate([
      { $match: { userId, type: "expense", date: { $regex: `^${p}` } } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
      { $limit: 7 },
    ]),
    TransactionModel.aggregate([
      { $match: { userId, type: "income", date: { $regex: `^${p}` } } },
      { $group: { _id: "$categoryId", amount: { $sum: "$amount" } } },
      { $sort: { amount: -1 } },
      { $limit: 7 },
    ]),
  ]);

  const expenseIds = expenseRows.map((r: any) => r._id);
  const incomeIds = incomeRows.map((r: any) => r._id);

  const [expenseCats, incomeCats] = await Promise.all([
    CategoryModel.find({ userId, _id: { $in: expenseIds } }).select("name icon color"),
    CategoryModel.find({ userId, _id: { $in: incomeIds } }).select("name icon color"),
  ]);

  const expenseMap = new Map(expenseCats.map((c) => [String(c._id), c]));
  const incomeMap = new Map(incomeCats.map((c) => [String(c._id), c]));

  const expense = expenseRows.map((r: any) => ({
    categoryId: String(r._id),
    name: expenseMap.get(String(r._id))?.name ?? "نامشخص",
    amount: r.amount ?? 0,
  }));

  const income = incomeRows.map((r: any) => ({
    categoryId: String(r._id),
    name: incomeMap.get(String(r._id))?.name ?? "نامشخص",
    amount: r.amount ?? 0,
  }));

  return sendSuccess(res, { month, year, expense, income });
});

