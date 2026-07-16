import mongoose from "mongoose";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";

function toObjectId(id: string | mongoose.Types.ObjectId) {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
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
