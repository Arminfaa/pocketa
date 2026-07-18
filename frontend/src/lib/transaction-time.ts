/** Prefer top-level time, then bankMeta.time. */
export function transactionTimeOf(tx: {
  time?: string | null;
  bankMeta?: { time?: string | null } | null;
}): string {
  const t = (tx.time || tx.bankMeta?.time || "").trim();
  if (!/^\d{1,2}:\d{2}/.test(t)) return "";
  const [hh, mm] = t.split(":");
  return `${String(hh).padStart(2, "0")}:${String(mm).slice(0, 2)}`;
}

export function formatTransactionDateTime(date: string, time?: string): string {
  if (!time) return date;
  return `${date} · ${time}`;
}
