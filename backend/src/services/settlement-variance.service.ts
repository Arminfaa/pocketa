import mongoose from "mongoose";
import { TransactionModel } from "../models/Transaction";
import { ensureNamedCategory } from "./accounting.service";

export const FEE_CATEGORY_NAME = "کارمزد";
export const EXCESS_PROFIT_CATEGORY_NAME = "سود مازاد";
export const PRICE_DIFF_CATEGORY_NAME = "مابه‌التفاوت قیمت";

export type SettlementVarianceKind = "fee" | "excess_profit" | "price_diff";

export type SettlementPlan = {
  expectedAmount: number;
  settledAmount: number;
  /**
   * Primary obligation TX amount.
   * When variance exists this is the expected (API) amount; companion TX
   * adjusts so net cash impact equals settledAmount.
   */
  primaryAmount: number;
  variance: {
    kind: SettlementVarianceKind;
    amount: number;
    type: "income" | "expense";
    categoryName: string;
    title: string;
  } | null;
};

/**
 * Bank-correct split so net cash impact equals settledAmount:
 *
 * Income (سود):
 * - کمتر از محاسبه → Income(expected) + Expense(کارمزد)
 * - بیشتر → Income(expected) + Income(سود مازاد)
 *
 * Expense (بدهی طلا/دلار):
 * - بیشتر از محاسبه → Expense(expected) + Expense(کارمزد)
 * - کمتر → Expense(expected) + Income(مابه‌التفاوت قیمت)
 */
export function planSettlementVariance(
  obligationType: "income" | "expense",
  expectedAmount: number,
  settledAmount: number
): SettlementPlan {
  const expected = Math.max(1, Math.round(expectedAmount));
  const settled = Math.max(1, Math.round(settledAmount));
  const diff = Math.abs(settled - expected);

  if (diff < 1) {
    return {
      expectedAmount: expected,
      settledAmount: settled,
      primaryAmount: settled,
      variance: null,
    };
  }

  if (obligationType === "income") {
    if (settled < expected) {
      return {
        expectedAmount: expected,
        settledAmount: settled,
        primaryAmount: expected,
        variance: {
          kind: "fee",
          amount: diff,
          type: "expense",
          categoryName: FEE_CATEGORY_NAME,
          title: "کارمزد — اختلاف تسویه",
        },
      };
    }
    return {
      expectedAmount: expected,
      settledAmount: settled,
      primaryAmount: expected,
      variance: {
        kind: "excess_profit",
        amount: diff,
        type: "income",
        categoryName: EXCESS_PROFIT_CATEGORY_NAME,
        title: "سود مازاد — اختلاف تسویه",
      },
    };
  }

  if (settled > expected) {
    return {
      expectedAmount: expected,
      settledAmount: settled,
      primaryAmount: expected,
      variance: {
        kind: "fee",
        amount: diff,
        type: "expense",
        categoryName: FEE_CATEGORY_NAME,
        title: "کارمزد — اختلاف تسویه",
      },
    };
  }

  return {
    expectedAmount: expected,
    settledAmount: settled,
    primaryAmount: expected,
    variance: {
      kind: "price_diff",
      amount: diff,
      type: "income",
      categoryName: PRICE_DIFF_CATEGORY_NAME,
      title: "مابه‌التفاوت قیمت — اختلاف تسویه",
    },
  };
}

async function ensureVarianceCategory(
  userId: string | mongoose.Types.ObjectId,
  name: string,
  type: "income" | "expense"
) {
  if (name === FEE_CATEGORY_NAME) {
    return ensureNamedCategory(userId, name, "expense", "Receipt", "#f59e0b");
  }
  if (name === EXCESS_PROFIT_CATEGORY_NAME) {
    return ensureNamedCategory(userId, name, "income", "TrendingUp", "#22c55e");
  }
  return ensureNamedCategory(userId, name, type, "Scale", "#06b6d4");
}

export async function createVarianceTransaction(input: {
  userId: string | mongoose.Types.ObjectId;
  accountId: string | mongoose.Types.ObjectId;
  date: string;
  time?: string;
  plan: SettlementPlan;
  parentTitle: string;
  linkedTransactionId?: mongoose.Types.ObjectId;
}) {
  const v = input.plan.variance;
  if (!v) return null;

  const category = await ensureVarianceCategory(input.userId, v.categoryName, v.type);

  return TransactionModel.create({
    userId: input.userId,
    accountId: input.accountId,
    categoryId: category._id,
    type: v.type,
    amount: v.amount,
    title: `${v.title} (${input.parentTitle})`,
    description: `مبلغ محاسبه‌شده ${input.plan.expectedAmount.toLocaleString("en-US")} — مبلغ واقعی ${input.plan.settledAmount.toLocaleString("en-US")} تومان`,
    date: input.date,
    time: input.time ?? "",
    source: "manual",
    needsReview: false,
    tags: ["اختلاف-تسویه", v.kind],
    linkedTransactionId: input.linkedTransactionId,
  });
}

/** Split cash amount vs due so extra (or shortfall on income) becomes an editable fee. */
export function splitPrincipalAndFee(input: {
  type: "income" | "expense";
  mode: "full" | "partial";
  amount: number;
  dueAmount: number;
  explicitFee?: number | null;
}): { principal: number; fee: number } {
  const amount = Math.round(input.amount);
  const due = Math.round(input.dueAmount);
  const explicit =
    input.explicitFee != null && Number.isFinite(input.explicitFee) && input.explicitFee > 0
      ? Math.round(input.explicitFee)
      : 0;

  if (input.mode === "partial") {
    return { principal: amount, fee: explicit };
  }

  if (input.type === "expense") {
    if (amount > due) {
      return { principal: due, fee: explicit > 0 ? explicit : amount - due };
    }
    return { principal: amount, fee: explicit };
  }

  if (amount < due) {
    return { principal: due, fee: explicit > 0 ? explicit : due - amount };
  }
  return { principal: amount, fee: explicit };
}

export async function createExplicitFeeTransaction(input: {
  userId: string | mongoose.Types.ObjectId;
  accountId: string | mongoose.Types.ObjectId;
  date: string;
  time?: string;
  amount: number;
  parentTitle: string;
  linkedTransactionId?: mongoose.Types.ObjectId;
}) {
  const fee = Math.round(input.amount);
  if (fee < 1) return null;

  const category = await ensureVarianceCategory(input.userId, FEE_CATEGORY_NAME, "expense");

  return TransactionModel.create({
    userId: input.userId,
    accountId: input.accountId,
    categoryId: category._id,
    type: "expense",
    amount: fee,
    title: `کارمزد — ${input.parentTitle}`,
    description: `کارمزد تسویه سررسید «${input.parentTitle}»`,
    date: input.date,
    time: input.time ?? "",
    source: "manual",
    needsReview: false,
    tags: ["کارمزد-سررسید", "fee"],
    linkedTransactionId: input.linkedTransactionId,
  });
}
