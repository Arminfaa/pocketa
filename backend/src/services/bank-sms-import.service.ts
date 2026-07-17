import jalaali from "jalaali-js";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import type { ParsedBankSms } from "./bank-sms-parser";

export function currentJalaliYear(): number {
  const now = new Date();
  const { jy } = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return jy;
}

export async function ensureBankSmsCategories(userId: string) {
  let income = await CategoryModel.findOne({ userId, type: "income", name: "واریز بانکی" });
  if (!income) {
    income = await CategoryModel.create({
      userId,
      name: "واریز بانکی",
      type: "income",
      icon: "Landmark",
      color: "#22c55e",
    });
  }

  let expense = await CategoryModel.findOne({ userId, type: "expense", name: "برداشت بانکی" });
  if (!expense) {
    expense = await CategoryModel.create({
      userId,
      name: "برداشت بانکی",
      type: "expense",
      icon: "Landmark",
      color: "#ef4444",
    });
  }

  return { income, expense };
}

export async function findExistingHashes(userId: string, hashes: string[]): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();
  const existing = await TransactionModel.find({
    userId,
    importHash: { $in: hashes },
  }).select("importHash");

  return new Set(existing.map((t) => String(t.importHash)));
}

export function defaultTitle(item: ParsedBankSms): string {
  if (item.suggestedTitle?.trim()) return item.suggestedTitle.trim();
  const kind = item.type === "income" ? "واریز" : "برداشت";
  const bank = item.bankName ? ` ${item.bankName}` : "";
  return `${kind}${bank} (بدون عنوان)`;
}
