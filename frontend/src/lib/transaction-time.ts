import { toPersianDigits } from "@/lib/format";

/** Prefer top-level time, then bankMeta.time. Returns HH:mm (English digits) for forms/API. */
export function transactionTimeOf(tx: {
  time?: string | null;
  bankMeta?: { time?: string | null } | null;
}): string {
  const t = (tx.time || tx.bankMeta?.time || "").trim();
  if (!/^\d{1,2}:\d{2}/.test(t)) return "";
  const [hh, mm] = t.split(":");
  return `${String(hh).padStart(2, "0")}:${String(mm).slice(0, 2)}`;
}

/** Display date · time with Persian digits (e.g. ۱۴۰۵/۰۴/۲۸ · ۱۴:۳۰). */
export function formatTransactionDateTime(date: string, time?: string): string {
  if (!time) return date;
  return `${date} · ${toPersianDigits(time)}`;
}
