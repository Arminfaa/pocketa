import type { Request, Response } from "express";
import jalaali from "jalaali-js";
import mongoose from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { BankAccountModel } from "../models/BankAccount";
import { ensureDefaultAccount } from "../services/account.service";
import {
  computeNetWorth,
  getActiveAccountIds,
  getNonOperatingCategoryIds,
} from "../services/accounting.service";
import { jalaliDaysBefore, todayJalali } from "../utils/jalaliDate";

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

async function sumOperatingByTypeAndMonth(
  userId: string,
  type: "income" | "expense",
  year: number,
  month: number,
  accountScope: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] },
  nonOpCategoryIds: mongoose.Types.ObjectId[]
) {
  const p = prefix(year, month);
  const match: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    type,
    date: { $regex: `^${p}` },
    accountId: accountScope,
    source: { $nin: ["transfer", "balance_adjustment", "investment", "goal"] },
  };
  if (nonOpCategoryIds.length > 0) {
    match.categoryId = { $nin: nonOpCategoryIds };
  }

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

  const activeIds = await getActiveAccountIds(userId);
  const nonOp = await getNonOperatingCategoryIds(userId);

  const accountScope: mongoose.Types.ObjectId | { $in: mongoose.Types.ObjectId[] } =
    accountId
      ? new mongoose.Types.ObjectId(accountId)
      : { $in: activeIds.length > 0 ? activeIds : [new mongoose.Types.ObjectId()] };

  const balanceMatch: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    accountId: accountScope,
  };

  const weekFrom = jalaliDaysBefore(6);
  const weekTo = todayJalali();

  const [incomeThis, expenseThis, incomePrev, expensePrev, overall, netWorth, recentWeek] =
    await Promise.all([
      sumOperatingByTypeAndMonth(userId, "income", year, month, accountScope, nonOp),
      sumOperatingByTypeAndMonth(userId, "expense", year, month, accountScope, nonOp),
      sumOperatingByTypeAndMonth(userId, "income", prev.year, prev.month, accountScope, nonOp),
      sumOperatingByTypeAndMonth(userId, "expense", prev.year, prev.month, accountScope, nonOp),
      TransactionModel.aggregate([
        { $match: balanceMatch },
        { $group: { _id: "$type", sum: { $sum: "$amount" } } },
      ]),
      accountId ? null : computeNetWorth(userId),
      TransactionModel.find({
        userId: new mongoose.Types.ObjectId(userId),
        accountId: accountScope,
        date: { $gte: weekFrom, $lte: weekTo },
        source: { $nin: ["transfer", "balance_adjustment"] },
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(20)
        .select("type amount title date categoryId accountId source needsReview")
        .populate("categoryId", "name type color")
        .lean(),
    ]);

  const totalByType = new Map<string, number>();
  for (const row of overall) totalByType.set(String(row._id), row.sum);

  const incomeTotal = totalByType.get("income") ?? 0;
  const expenseTotal = totalByType.get("expense") ?? 0;

  // Full ledger identity (includes opening/adjustment/transfers/investments/goals)
  const balance = incomeTotal - expenseTotal;

  const savings = incomeThis - expenseThis;
  const savingsPercent = incomeThis > 0 ? (savings / incomeThis) * 100 : 0;

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
    netWorth: netWorth
      ? {
          cash: netWorth.cash,
          investmentsValue: netWorth.investmentsValue,
          liabilities: netWorth.liabilities,
          receivables: netWorth.receivables,
          netWorth: netWorth.netWorth,
        }
      : null,
    recentWeek: {
      from: weekFrom,
      to: weekTo,
      items: recentWeek.map((tx) => {
        const cat = tx.categoryId as
          | { _id?: unknown; name?: string; type?: string; color?: string }
          | null
          | undefined;
        return {
          id: String(tx._id),
          type: tx.type as "income" | "expense",
          amount: Number(tx.amount),
          title: String(tx.title ?? ""),
          date: String(tx.date),
          needsReview: Boolean(tx.needsReview),
          categoryName: cat?.name ? String(cat.name) : "",
        };
      }),
    },
  });
});
