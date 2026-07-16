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
