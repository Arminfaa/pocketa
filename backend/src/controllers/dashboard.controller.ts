import type { Request, Response } from "express";
import jalaali from "jalaali-js";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { BankAccountModel } from "../models/BankAccount";
import { ensureDefaultAccount } from "../services/account.service";

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

async function sumByTypeAndMonth(
  userId: string,
  type: "income" | "expense",
  year: number,
  month: number,
  accountId?: string
) {
  const p = prefix(year, month);
  const match: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    type,
    date: { $regex: `^${p}` },
  };
  if (accountId) match.accountId = new mongoose.Types.ObjectId(accountId);

  const result = await TransactionModel.aggregate([
    { $match: match },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]);
  return result[0]?.sum ?? 0;
}

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  await ensureDefaultAccount(userId);

  const accountId =
    typeof req.query.accountId === "string" && req.query.accountId.trim()
      ? req.query.accountId.trim()
      : undefined;

  if (accountId) {
    const account = await BankAccountModel.findOne({ _id: accountId, userId });
    if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
  }

  const { year, month } = currentJalaliMonthYear();
  const prev = prevMonthYear(year, month);

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const overallMatch: Record<string, unknown> = { userId: userObjectId };
  if (accountId) overallMatch.accountId = new mongoose.Types.ObjectId(accountId);

  const [incomeThis, expenseThis, incomePrev, expensePrev, overall] = await Promise.all([
    sumByTypeAndMonth(userId, "income", year, month, accountId),
    sumByTypeAndMonth(userId, "expense", year, month, accountId),
    sumByTypeAndMonth(userId, "income", prev.year, prev.month, accountId),
    sumByTypeAndMonth(userId, "expense", prev.year, prev.month, accountId),
    TransactionModel.aggregate([
      { $match: overallMatch },
      { $group: { _id: "$type", sum: { $sum: "$amount" } } },
    ]),
  ]);

  const totalByType = new Map<string, number>();
  for (const row of overall) totalByType.set(String(row._id), row.sum);

  const incomeTotal = totalByType.get("income") ?? 0;
  const expenseTotal = totalByType.get("expense") ?? 0;

  let initialBalance = 0;
  if (accountId) {
    const account = await BankAccountModel.findById(accountId);
    initialBalance = account?.initialBalance ?? 0;
  } else {
    const accounts = await BankAccountModel.find({ userId, isActive: true });
    initialBalance = accounts.reduce((sum, a) => sum + (a.initialBalance ?? 0), 0);
  }

  const balance = initialBalance + incomeTotal - expenseTotal;

  const savings = incomeThis - expenseThis;
  const savingsPercent = incomeThis > 0 ? Math.max(0, (savings / incomeThis) * 100) : 0;

  return sendSuccess(res, {
    currentMonth: { year, month },
    accountId: accountId ?? null,
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
