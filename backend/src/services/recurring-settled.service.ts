import mongoose from "mongoose";
import { TransactionModel } from "../models/Transaction";

/**
 * Sum of this month's settlement transactions per recurring item.
 * Used so the month checklist can show the amount actually paid/received,
 * not the original due (important for partial settlement).
 */
export async function settledAmountsByRecurring(
  userId: string | mongoose.Types.ObjectId,
  year: number,
  month: number
): Promise<Map<string, number>> {
  const prefix = `${year}/${String(month).padStart(2, "0")}/`;
  const rows = await TransactionModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        settledRecurringId: { $ne: null },
        date: { $regex: `^${prefix}` },
      },
    },
    {
      $group: {
        _id: "$settledRecurringId",
        sum: { $sum: "$amount" },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id) map.set(String(row._id), Number(row.sum) || 0);
  }
  return map;
}

/** Amount to show on a ticked checklist row for this month. */
export function resolvePaidAmountThisMonth(input: {
  paidThisMonth: boolean;
  kind: "recurring" | "one_time";
  amount: number;
  baseAmount: number;
  lastSettledAmount?: number | null;
  settledFromTransactions?: number | null;
}): number | null {
  if (!input.paidThisMonth) return null;

  const fromTx = input.settledFromTransactions;
  if (fromTx != null && fromTx > 0) return Math.round(fromTx);

  const last = input.lastSettledAmount;
  if (last != null && last > 0) return Math.round(last);

  if (input.kind === "recurring" && input.baseAmount > 0) {
    return Math.round(input.baseAmount);
  }
  return Math.round(input.amount);
}
