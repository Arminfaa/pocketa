import { toPersianDigits } from "@/lib/format";

/** Current clock time HH:mm in Asia/Tehran (English digits). */
export function getNowTehranClockTime(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

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
