import mongoose from "mongoose";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import { todayJalali } from "../utils/jalaliDate";

function toObjectId(id: string | mongoose.Types.ObjectId) {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

const OPENING_CATEGORY_NAME = "موجودی اولیه";

/** Find or create the income category used for account opening balances. */
export async function ensureOpeningBalanceCategory(
  userId: string | mongoose.Types.ObjectId
) {
  const existing = await CategoryModel.findOne({
    userId: toObjectId(userId),
    name: OPENING_CATEGORY_NAME,
    type: "income",
  });
  if (existing) return existing;

  return CategoryModel.create({
    userId: toObjectId(userId),
    name: OPENING_CATEGORY_NAME,
    type: "income",
    icon: "Wallet",
    color: "#06b6d4",
  });
}

/**
 * Create an income transaction for the account's opening balance so reports
 * and balance math stay consistent (initialBalance on the account stays 0).
 */
export async function createOpeningBalanceTransaction(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId,
  amount: number
) {
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const category = await ensureOpeningBalanceCategory(userId);
  return TransactionModel.create({
    userId: toObjectId(userId),
    accountId: toObjectId(accountId),
    type: "income",
    amount,
    categoryId: category._id,
    title: OPENING_CATEGORY_NAME,
    description: "موجودی اولیه هنگام ایجاد حساب",
    date: todayJalali(),
    tags: ["موجودی-اولیه"],
    source: "manual",
    needsReview: false,
  });
}

export async function ensureDefaultAccount(userId: string | mongoose.Types.ObjectId) {
  const existing = await BankAccountModel.findOne({ userId, isActive: true }).sort({
    createdAt: 1,
  });
  if (existing) return existing;

  return BankAccountModel.create({
    userId,
    name: "حساب اصلی",
    bankName: "",
    color: "#06b6d4",
    icon: "Landmark",
    initialBalance: 0,
    isActive: true,
  });
}

export async function computeAccountBalance(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId,
  initialBalance: number
): Promise<number> {
  const rows = await TransactionModel.aggregate([
    {
      $match: {
        userId: toObjectId(userId),
        accountId: toObjectId(accountId),
      },
    },
    { $group: { _id: "$type", sum: { $sum: "$amount" } } },
  ]);

  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row._id === "income") income = row.sum ?? 0;
    if (row._id === "expense") expense = row.sum ?? 0;
  }

  return initialBalance + income - expense;
}

/** Adjust initialBalance so computed balance equals targetBalance (e.g. SMS مانده). */
export async function syncInitialBalanceToTarget(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId,
  targetBalance: number
): Promise<{
  previousBalance: number;
  balance: number;
  initialBalance: number;
  previousInitialBalance: number;
}> {
  const account = await BankAccountModel.findOne({
    _id: toObjectId(accountId),
    userId: toObjectId(userId),
  });
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  const previousBalance = await computeAccountBalance(
    userId,
    accountId,
    account.initialBalance
  );
  const netFromTransactions = previousBalance - account.initialBalance;
  const previousInitialBalance = account.initialBalance;
  const nextInitial = targetBalance - netFromTransactions;

  account.initialBalance = nextInitial;
  await account.save();

  return {
    previousBalance,
    balance: targetBalance,
    initialBalance: nextInitial,
    previousInitialBalance,
  };
}

/** Latest bankMeta.balanceAfter for account (by date/time then createdAt). */
export async function findLatestSmsBalance(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId
): Promise<number | null> {
  const tx = await TransactionModel.findOne({
    userId: toObjectId(userId),
    accountId: toObjectId(accountId),
    "bankMeta.balanceAfter": { $exists: true, $ne: null },
  })
    .sort({ date: -1, createdAt: -1 })
    .select("bankMeta.balanceAfter")
    .lean();

  const value = tx?.bankMeta?.balanceAfter;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
