import jalaali from "jalaali-js";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

function parseJalali(date: string): { jy: number; jm: number; jd: number } {
  const normalized = normalizeJalaliDate(toEnglishDigits(date));
  const [y, m, d] = normalized.split("/").map(Number);
  return { jy: y!, jm: m!, jd: d! };
}

function formatJalali(jy: number, jm: number, jd: number): string {
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

function clampDay(jy: number, jm: number, day: number): number {
  const maxDay = jalaali.jalaaliMonthLength(jy, jm);
  return Math.min(Math.max(1, day), maxDay);
}

/** Build Jalali YYYY/MM/DD for a given year/month and preferred day-of-month. */
export function jalaliDateFromDay(jy: number, jm: number, dayOfMonth: number): string {
  return formatJalali(jy, jm, clampDay(jy, jm, dayOfMonth));
}

/**
 * Next due date for a monthly day-of-month schedule.
 * If today's day is already past dayOfMonth this month, returns next month.
 * If today equals dayOfMonth, returns today (still due).
 */
export function nextOccurrenceFromDayOfMonth(
  dayOfMonth: number,
  from = todayJalali()
): string {
  const { jy, jm, jd } = parseJalali(from);
  const day = clampDay(jy, jm, dayOfMonth);

  if (jd <= day) {
    return formatJalali(jy, jm, day);
  }

  let nextMonth = jm + 1;
  let nextYear = jy;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return jalaliDateFromDay(nextYear, nextMonth, dayOfMonth);
}

/** Advance one month keeping the preferred day-of-month (clamped to month length). */
export function advanceMonthlyByDay(date: string, dayOfMonth: number): string {
  const { jy, jm } = parseJalali(date);
  let nextMonth = jm + 1;
  let nextYear = jy;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  return jalaliDateFromDay(nextYear, nextMonth, dayOfMonth);
}

/** Advance a Jalali date by frequency. */
export function advanceJalaliDate(date: string, frequency: Frequency): string {
  const { jy, jm, jd } = parseJalali(date);

  if (frequency === "daily") {
    const g = jalaali.toGregorian(jy, jm, jd);
    const dt = new Date(g.gy, g.gm - 1, g.gd);
    dt.setDate(dt.getDate() + 1);
    const j = jalaali.toJalaali(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    return formatJalali(j.jy, j.jm, j.jd);
  }

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

/** YYYY/MM from a Jalali date string. */
export function jalaliYearMonth(date: string): string {
  return normalizeJalaliDate(toEnglishDigits(date)).slice(0, 7);
}

export function isSameJalaliMonth(a: string, b = todayJalali()): boolean {
  return jalaliYearMonth(a) === jalaliYearMonth(b);
}

/** Calendar-day difference: target − from (positive => target is in the future). */
export function jalaliDaysUntil(target: string, from = todayJalali()): number {
  const t = parseJalali(target);
  const f = parseJalali(from);
  const tg = jalaali.toGregorian(t.jy, t.jm, t.jd);
  const fg = jalaali.toGregorian(f.jy, f.jm, f.jd);
  const tMs = Date.UTC(tg.gy, tg.gm - 1, tg.gd);
  const fMs = Date.UTC(fg.gy, fg.gm - 1, fg.gd);
  return Math.round((tMs - fMs) / 86_400_000);
}

/** Compare YYYY/MM/DD lexicographically after normalize. */
export function isDueOnOrBefore(nextPaymentDate: string, today = todayJalali()): boolean {
  return normalizeJalaliDate(nextPaymentDate) <= normalizeJalaliDate(today);
}
