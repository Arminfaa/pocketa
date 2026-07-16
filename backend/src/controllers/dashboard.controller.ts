import type { Request, Response } from "express";
import jalaali from "jalaali-js";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";

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

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { year, month } = currentJalaliMonthYear();
  const prev = prevMonthYear(year, month);

  const [incomeThis, expenseThis, incomePrev, expensePrev, overall] = await Promise.all([
    sumByTypeAndMonth(userId, "income", year, month),
    sumByTypeAndMonth(userId, "expense", year, month),
    sumByTypeAndMonth(userId, "income", prev.year, prev.month),
    sumByTypeAndMonth(userId, "expense", prev.year, prev.month),
    TransactionModel.aggregate([
      { $match: { userId } },
      { $group: { _id: "$type", sum: { $sum: "$amount" } } },
    ]),
  ]);

  const totalByType = new Map<string, number>();
  for (const row of overall) totalByType.set(String(row._id), row.sum);

  const incomeTotal = totalByType.get("income") ?? 0;
  const expenseTotal = totalByType.get("expense") ?? 0;
  const balance = incomeTotal - expenseTotal;

  const savings = incomeThis - expenseThis;
  const savingsPercent = incomeThis > 0 ? Math.max(0, (savings / incomeThis) * 100) : 0;

  return sendSuccess(res, {
    currentMonth: { year, month },
    comparison: {
      incomeDelta: incomeThis - incomePrev,
      expenseDelta: expenseThis - expensePrev,
      savingsDelta: savings - (incomePrev - expensePrev),
    },
    totals: {
      balance,
      incomeThisMonth: incomeThis,
      expenseThisMonth: expenseThis,
      savingsPercent,
    },
  });
});

