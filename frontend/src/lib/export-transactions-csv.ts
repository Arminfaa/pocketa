import type { Transaction } from "@/types/transaction";
import { accountName, categoryName } from "@/lib/transaction-helpers";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportTransactionsCsv(items: Transaction[], filename = "pocketa-transactions.csv") {
  const header = ["تاریخ", "نوع", "دسته‌بندی", "حساب", "عنوان", "مبلغ", "توضیحات", "نیاز به بررسی"];
  const rows = items.map((tx) => [
    tx.date,
    tx.type === "income" ? "درآمد" : "هزینه",
    categoryName(tx.categoryId),
    accountName(tx.accountId),
    tx.title,
    String(tx.amount),
    tx.description ?? "",
    tx.needsReview ? "بله" : "خیر",
  ]);

  const bom = "\uFEFF";
  const csv =
    bom +
    [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(String(cell))).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
