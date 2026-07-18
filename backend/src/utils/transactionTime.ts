import { toEnglishDigits } from "./normalizeDigits";

/** Normalize to HH:mm or empty string. */
export function normalizeTime(input: string | null | undefined): string {
  if (!input) return "";
  const t = toEnglishDigits(String(input)).trim();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return "";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Pull HH:mm from bank SMS / receipt / description text.
 * Covers common Iranian bank formats used by our parsers.
 */
export function extractTimeFromText(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = toEnglishDigits(raw)
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");

  const tryNorm = (hh?: string, mm?: string) =>
    hh != null && mm != null ? normalizeTime(`${hh}:${mm}`) : "";

  // ساعت: HH:mm[:ss]
  {
    const m = text.match(/ساعت\s*:?\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
    const t = tryNorm(m?.[1], m?.[2]);
    if (t) return t;
  }

  // تاریخ و ساعت: HH:mm … or … HH:mm YYYY/MM/DD
  {
    const m = text.match(/تاریخ\s*و\s*ساعت\s*:?\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
    const t = tryNorm(m?.[1], m?.[2]);
    if (t) return t;
  }

  // YYYY/MM/DD HH:mm
  {
    const m = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?/);
    const t = tryNorm(m?.[4], m?.[5]);
    if (t) return t;
  }

  // HH:mm YYYY/MM/DD (card receipt style)
  {
    const m = text.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s+(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    const t = tryNorm(m?.[1], m?.[2]);
    if (t) return t;
  }

  // Melli short: MMDD-HH:mm
  {
    const m = text.match(/\b(\d{2})(\d{2})-(\d{2}):(\d{2})\b/);
    const t = tryNorm(m?.[3], m?.[4]);
    if (t) return t;
  }

  // Pasargad: MM/DD_HH:mm
  {
    const m = text.match(/\b(\d{1,2})\/(\d{1,2})_(\d{1,2}):(\d{2})\b/);
    const t = tryNorm(m?.[3], m?.[4]);
    if (t) return t;
  }

  // Compact SMS last line HH:mm after MM/DD
  {
    const m = text.match(/(?:^|\n)\s*(\d{1,2})\/(\d{1,2})\s*\n\s*(\d{1,2}):(\d{2})\s*(?:\n|$)/);
    const t = tryNorm(m?.[3], m?.[4]);
    if (t) return t;
  }

  // Lone HH:mm line
  {
    const m = text.match(/(?:^|\n)\s*(\d{1,2}):(\d{2})\s*(?:\n|$)/);
    const t = tryNorm(m?.[1], m?.[2]);
    if (t) return t;
  }

  return "";
}

/** Prefer explicit time, then bankMeta.time, then parse from snippet/description. */
export function resolveTransactionTime(parts: {
  time?: string | null;
  bankMetaTime?: string | null;
  rawSnippet?: string | null;
  description?: string | null;
}): string {
  return (
    normalizeTime(parts.time) ||
    normalizeTime(parts.bankMetaTime) ||
    extractTimeFromText(parts.rawSnippet) ||
    extractTimeFromText(parts.description) ||
    ""
  );
}
