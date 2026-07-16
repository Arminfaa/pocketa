import jalaali from "jalaali-js";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";

export type Frequency = "weekly" | "monthly" | "yearly";

function parseJalali(date: string): { jy: number; jm: number; jd: number } {
  const normalized = normalizeJalaliDate(toEnglishDigits(date));
  const [y, m, d] = normalized.split("/").map(Number);
  return { jy: y!, jm: m!, jd: d! };
}

function formatJalali(jy: number, jm: number, jd: number): string {
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

/** Advance a Jalali date by frequency. */
export function advanceJalaliDate(date: string, frequency: Frequency): string {
  const { jy, jm, jd } = parseJalali(date);

  if (frequency === "weekly") {
    const g = jalaali.toGregorian(jy, jm, jd);
    const dt = new Date(g.gy, g.gm - 1, g.gd);
    dt.setDate(dt.getDate() + 7);
    const j = jalaali.toJalaali(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    return formatJalali(j.jy, j.jm, j.jd);
  }

  if (frequency === "yearly") {
    const nextYear = jy + 1;
    const maxDay = jalaali.jalaaliMonthLength(nextYear, jm);
    return formatJalali(nextYear, jm, Math.min(jd, maxDay));
  }

  // monthly
  let nextMonth = jm + 1;
  let nextYear = jy;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const maxDay = jalaali.jalaaliMonthLength(nextYear, nextMonth);
  return formatJalali(nextYear, nextMonth, Math.min(jd, maxDay));
}

export function todayJalali(): string {
  const now = new Date();
  const j = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return formatJalali(j.jy, j.jm, j.jd);
}

/** Compare YYYY/MM/DD lexicographically after normalize. */
export function isDueOnOrBefore(nextPaymentDate: string, today = todayJalali()): boolean {
  return normalizeJalaliDate(nextPaymentDate) <= normalizeJalaliDate(today);
}
