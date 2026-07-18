import mongoose from "mongoose";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import { todayJalali } from "../utils/jalaliDate";

function toObjectId(id: string | mongoose.Types.ObjectId) {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

export const OPENING_CATEGORY_NAME = "موجودی اولیه";
export const ADJUSTMENT_CATEGORY_NAME = "تعدیل موجودی";

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

async function ensureAdjustmentCategory(
  userId: string | mongoose.Types.ObjectId,
  type: "income" | "expense"
) {
  const existing = await CategoryModel.findOne({
    userId: toObjectId(userId),
    name: ADJUSTMENT_CATEGORY_NAME,
    type,
  });
  if (existing) return existing;

  return CategoryModel.create({
    userId: toObjectId(userId),
    name: ADJUSTMENT_CATEGORY_NAME,
    type,
    icon: "Scale",
    color: type === "income" ? "#06b6d4" : "#f59e0b",
  });
}

/**
 * Create an income transaction for the account's opening balance so
 * balance = Σ income − Σ expense stays the single source of truth
 * (account.initialBalance stays 0).
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

/**
 * Ledger balance for one account.
 * Accounting identity: موجودی = جمع درآمد − جمع هزینه
 */
export async function computeAccountBalance(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId
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

  return income - expense;
}

/**
 * Set book balance to target by posting an adjustment transaction for the
 * difference (Cash Over/Short). Never mutates a hidden initialBalance plug.
 */
export async function adjustAccountBalanceToTarget(
  userId: string | mongoose.Types.ObjectId,
  accountId: string | mongoose.Types.ObjectId,
  targetBalance: number
): Promise<{
  previousBalance: number;
  balance: number;
  adjustment: {
    type: "income" | "expense";
    amount: number;
    id: string;
  } | null;
}> {
  if (!Number.isFinite(targetBalance)) {
    throw new Error("INVALID_TARGET_BALANCE");
  }

  const account = await BankAccountModel.findOne({
    _id: toObjectId(accountId),
    userId: toObjectId(userId),
  });
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND");
  }

  // Legacy plug must not affect the books — zero it if present.
  if (account.initialBalance !== 0) {
    account.initialBalance = 0;
    await account.save();
  }

  const previousBalance = await computeAccountBalance(userId, accountId);
  const delta = Math.round(targetBalance) - Math.round(previousBalance);

  if (delta === 0) {
    return {
      previousBalance,
      balance: previousBalance,
      adjustment: null,
    };
  }

  const type: "income" | "expense" = delta > 0 ? "income" : "expense";
  const amount = Math.abs(delta);
  const category = await ensureAdjustmentCategory(userId, type);

  const tx = await TransactionModel.create({
    userId: toObjectId(userId),
    accountId: toObjectId(accountId),
    type,
    amount,
    categoryId: category._id,
    title: ADJUSTMENT_CATEGORY_NAME,
    description:
      type === "expense"
        ? `تعدیل موجودی: کاهش دفتر به ${Math.round(targetBalance).toLocaleString("en-US")} تومان`
        : `تعدیل موجودی: افزایش دفتر به ${Math.round(targetBalance).toLocaleString("en-US")} تومان`,
    date: todayJalali(),
    tags: ["تعدیل-موجودی"],
    source: "balance_adjustment",
    needsReview: false,
  });

  const balance = await computeAccountBalance(userId, accountId);

  return {
    previousBalance,
    balance,
    adjustment: {
      type,
      amount,
      id: String(tx._id),
    },
  };
}

/**
 * Convert legacy account.initialBalance plugs into real ledger entries so
 * balance = income − expense remains exact after the field is zeroed.
 */
export async function migrateLegacyInitialBalances(): Promise<{
  accountsUpdated: number;
}> {
  const accounts = await BankAccountModel.find({
    initialBalance: { $ne: 0 },
  });

  let accountsUpdated = 0;

  for (const account of accounts) {
    const plug = Number(account.initialBalance ?? 0);
    if (!Number.isFinite(plug) || plug === 0) continue;

    const amount = Math.abs(Math.round(plug));
    if (amount > 0) {
      const type: "income" | "expense" = plug > 0 ? "income" : "expense";
      const category = await ensureAdjustmentCategory(account.userId, type);
      await TransactionModel.create({
        userId: account.userId,
        accountId: account._id,
        type,
        amount,
        categoryId: category._id,
        title: ADJUSTMENT_CATEGORY_NAME,
        description:
          "تبدیل موجودی اولیه قدیمی حساب به تراکنش دفتر (مهاجرت حسابداری)",
        date: todayJalali(),
        tags: ["تعدیل-موجودی", "مهاجرت"],
        source: "balance_adjustment",
        needsReview: false,
      });
    }

    account.initialBalance = 0;
    await account.save();
    accountsUpdated += 1;
  }

  return { accountsUpdated };
}
