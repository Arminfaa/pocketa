import mongoose from "mongoose";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import { ensureNamedCategory } from "./accounting.service";

export const DEDUCTION_CATEGORY_NAME = "کسورات";

export type SettlementDeductionInput = {
  title: string;
  amount: number;
  categoryId?: string | null;
};

export async function createDeductionTransactions(input: {
  userId: string | mongoose.Types.ObjectId;
  accountId: string | mongoose.Types.ObjectId;
  date: string;
  parentTitle: string;
  linkedTransactionId: mongoose.Types.ObjectId;
  deductions: SettlementDeductionInput[];
}) {
  if (!input.deductions.length) return [];

  const fallbackCategory = await ensureNamedCategory(
    input.userId,
    DEDUCTION_CATEGORY_NAME,
    "expense",
    "MinusCircle",
    "#ef4444"
  );

  const created = [];
  for (const d of input.deductions) {
    const amount = Math.max(1, Math.round(d.amount));
    let categoryId = fallbackCategory._id;
    if (d.categoryId) {
      const cat = await CategoryModel.findOne({
        _id: d.categoryId,
        userId: input.userId,
        type: "expense",
      });
      if (cat) categoryId = cat._id;
    }

    const tx = await TransactionModel.create({
      userId: input.userId,
      accountId: input.accountId,
      categoryId,
      type: "expense",
      amount,
      title: `${d.title} — کسورات (${input.parentTitle})`,
      description: `کسورات از «${input.parentTitle}»`,
      date: input.date,
      source: "manual",
      needsReview: false,
      tags: ["کسورات"],
      linkedTransactionId: input.linkedTransactionId,
    });
    created.push(tx);
  }

  return created;
}
