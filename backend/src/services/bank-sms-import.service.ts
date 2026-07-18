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

/** Same account/date/amount/type — catches card-to-card vs bank SMS double imports. */
export function nearDuplicateKey(parts: {
  accountId: string;
  type: string;
  amount: number;
  date: string;
}): string {
  return `${parts.accountId}|${parts.type}|${Math.round(parts.amount)}|${parts.date}`;
}

/**
 * Mark items that already exist as a bank tx with same direction/amount/day
 * (even when importHash differs — e.g. رسید کارت‌به‌کارت + پیامک همان انتقال).
 */
export async function findNearDuplicateImportKeys(
  userId: string,
  accountId: string,
  items: Array<{ type: string; amount: number; date: string; transferAmount?: number }>
): Promise<Set<string>> {
  if (items.length === 0) return new Set();

  const amounts = [
    ...new Set(
      items.flatMap((i) => {
        const vals = [Math.round(i.amount)];
        if (i.transferAmount != null) vals.push(Math.round(i.transferAmount));
        return vals;
      })
    ),
  ];
  const dates = [...new Set(items.map((i) => i.date))];

  const existing = await TransactionModel.find({
    userId,
    accountId,
    date: { $in: dates },
    amount: { $in: amounts },
  })
    .select("type amount date bankMeta")
    .lean();

  return new Set(
    existing.flatMap((t) => {
      const keys = [
        nearDuplicateKey({
          accountId,
          type: String(t.type),
          amount: Number(t.amount),
          date: String(t.date),
        }),
      ];
      const transferAmount = Number(
        (t as { bankMeta?: { transferAmount?: number } }).bankMeta?.transferAmount
      );
      if (Number.isFinite(transferAmount) && transferAmount > 0) {
        keys.push(
          nearDuplicateKey({
            accountId,
            type: String(t.type),
            amount: transferAmount,
            date: String(t.date),
          })
        );
      }
      return keys;
    })
  );
}

/** Near-dupe check amount: prefer base transfer (بدون کارمزد) when present. */
export function nearDuplicateAmount(item: {
  amount: number;
  transferAmount?: number;
}): number {
  return Math.round(item.transferAmount ?? item.amount);
}

export function defaultTitle(item: ParsedBankSms): string {
  if (item.suggestedTitle?.trim()) return item.suggestedTitle.trim();
  const kind = item.type === "income" ? "واریز" : "برداشت";
  const bank = item.bankName ? ` ${item.bankName}` : "";
  return `${kind}${bank} (بدون عنوان)`;
}
