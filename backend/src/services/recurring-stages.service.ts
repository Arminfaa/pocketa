import {
  advanceJalaliDate,
  advanceMonthlyByDay,
  jalaliDateFromDay,
  jalaliYearMonth,
  todayJalali,
  type Frequency,
} from "../utils/jalaliDate";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";

export type StageFields = {
  amount: number;
  baseAmount?: number | null;
  dayOfMonth?: number | null;
  paymentDays?: number[] | null;
  stageAmounts?: number[] | null;
  nextPaymentDate: string;
  paymentsMade?: number | null;
  endMode?: string | null;
  endMonths?: number | null;
  active: boolean;
  kind?: string | null;
  scheduleFrequency?: string | null;
  endDate?: string | null;
};

function parseYmd(date: string): { jy: number; jm: number; jd: number } {
  const [y, m, d] = normalizeJalaliDate(toEnglishDigits(date)).split("/").map(Number);
  return { jy: y!, jm: m!, jd: d! };
}

/** Unique sorted payment days (1–31). Falls back to dayOfMonth / nextPaymentDate day. */
export function resolvePaymentDays(item: {
  paymentDays?: number[] | null;
  dayOfMonth?: number | null;
  nextPaymentDate?: string | null;
}): number[] {
  const raw = (item.paymentDays ?? [])
    .map((d) => Math.round(Number(d)))
    .filter((d) => Number.isFinite(d) && d >= 1 && d <= 31);
  const unique = [...new Set(raw)].sort((a, b) => a - b);
  if (unique.length > 0) return unique;

  if (item.dayOfMonth != null && item.dayOfMonth >= 1 && item.dayOfMonth <= 31) {
    return [item.dayOfMonth];
  }

  if (item.nextPaymentDate) {
    const day = Number(
      normalizeJalaliDate(toEnglishDigits(item.nextPaymentDate)).split("/")[2]
    );
    if (Number.isFinite(day) && day >= 1 && day <= 31) return [day];
  }

  return [1];
}

export function resolveMonthlyAmount(item: {
  amount: number;
  baseAmount?: number | null;
}): number {
  const base = item.baseAmount;
  return typeof base === "number" && base > 0 ? base : item.amount;
}

/** Per-stage amounts; equal split of monthly total when stageAmounts missing/invalid. */
export function resolveStageAmounts(item: {
  amount: number;
  baseAmount?: number | null;
  paymentDays?: number[] | null;
  stageAmounts?: number[] | null;
  dayOfMonth?: number | null;
  nextPaymentDate?: string | null;
}): number[] {
  const days = resolvePaymentDays(item);
  const monthly = resolveMonthlyAmount(item);
  const raw = (item.stageAmounts ?? [])
    .map((a) => Math.round(Number(a)))
    .filter((a) => Number.isFinite(a) && a > 0);

  if (raw.length === days.length) return raw;

  const base = Math.floor(monthly / days.length);
  const amounts = days.map(() => Math.max(1, base));
  let remainder = monthly - amounts.reduce((s, n) => s + n, 0);
  let i = 0;
  while (remainder !== 0 && amounts.length > 0) {
    const step = remainder > 0 ? 1 : -1;
    amounts[i % amounts.length]! += step;
    remainder -= step;
    i += 1;
    if (i > monthly + days.length) break;
  }
  return amounts.map((a) => Math.max(1, a));
}

export function currentStageIndex(item: {
  paymentDays?: number[] | null;
  dayOfMonth?: number | null;
  nextPaymentDate: string;
}): number {
  const days = resolvePaymentDays(item);
  const jd = parseYmd(item.nextPaymentDate).jd;
  const exact = days.indexOf(jd);
  if (exact >= 0) return exact;

  // Clamp: if next day is between stages, pick the next upcoming stage in list
  for (let i = 0; i < days.length; i++) {
    if (days[i]! >= jd) return i;
  }
  return days.length - 1;
}

export function currentStageDueAmount(item: {
  amount: number;
  baseAmount?: number | null;
  paymentDays?: number[] | null;
  stageAmounts?: number[] | null;
  dayOfMonth?: number | null;
  nextPaymentDate: string;
}): number {
  const days = resolvePaymentDays(item);
  if (days.length <= 1) {
    return Math.max(1, Math.round(item.amount));
  }
  const amounts = resolveStageAmounts(item);
  const idx = currentStageIndex(item);
  const stage = amounts[idx] ?? amounts[0]!;
  // Rolled remainder from partial (amount > monthly base) attaches to current stage
  const monthly = resolveMonthlyAmount(item);
  const rolled = Math.max(0, Math.round(item.amount) - monthly);
  return Math.max(1, Math.round(stage + rolled));
}

export function lastStageDueThisMonth(
  item: {
    paymentDays?: number[] | null;
    dayOfMonth?: number | null;
    nextPaymentDate?: string | null;
  },
  refDate: string = todayJalali()
): string {
  const days = resolvePaymentDays(item);
  const lastDay = days[days.length - 1]!;
  const { jy, jm } = parseYmd(refDate);
  return jalaliDateFromDay(jy, jm, lastDay);
}

/**
 * Advance after settling/postponing the current stage.
 * Mid-month stages stay in the same month; last stage moves to next month's first day.
 * When `countMonth` is true, increments paymentsMade only when a full month cycle completes.
 */
export function advancePaymentSchedule(
  recurring: StageFields,
  options?: { countMonth?: boolean }
): {
  monthCompleted: boolean;
} {
  const countMonth = options?.countMonth !== false;
  const kind = (recurring.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  if (kind === "one_time") {
    recurring.active = false;
    return { monthCompleted: true };
  }

  const frequency = (recurring.scheduleFrequency as Frequency | undefined) ?? "monthly";
  const days = resolvePaymentDays(recurring);
  const idx = currentStageIndex(recurring);

  if (frequency !== "monthly") {
    recurring.nextPaymentDate = advanceJalaliDate(recurring.nextPaymentDate, frequency);
    if (countMonth) {
      recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    }
    applyEndRules(recurring);
    return { monthCompleted: true };
  }

  if (days.length <= 1) {
    recurring.nextPaymentDate = advanceMonthlyByDay(recurring.nextPaymentDate, days[0]!);
    if (countMonth) {
      recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    }
    applyEndRules(recurring);
    return { monthCompleted: true };
  }

  if (idx < days.length - 1) {
    const { jy, jm } = parseYmd(recurring.nextPaymentDate);
    recurring.nextPaymentDate = jalaliDateFromDay(jy, jm, days[idx + 1]!);
    applyEndRules(recurring);
    return { monthCompleted: false };
  }

  recurring.nextPaymentDate = advanceMonthlyByDay(recurring.nextPaymentDate, days[0]!);
  if (countMonth) {
    recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
  }
  applyEndRules(recurring);
  return { monthCompleted: true };
}

function applyEndRules(recurring: StageFields) {
  const endMode = recurring.endMode ?? "forever";
  const paymentsMade = recurring.paymentsMade ?? 0;
  if (
    endMode === "months" &&
    recurring.endMonths != null &&
    paymentsMade >= recurring.endMonths
  ) {
    recurring.active = false;
  }

  const endDate = recurring.endDate ? normalizeJalaliDate(recurring.endDate) : "";
  if (endDate && normalizeJalaliDate(recurring.nextPaymentDate) > endDate) {
    recurring.active = false;
  }
}

/** Next occurrence among multiple monthly days (earliest upcoming from `from`). */
export function nextOccurrenceFromPaymentDays(
  paymentDays: number[],
  from: string = todayJalali()
): string {
  const days = [...new Set(paymentDays.filter((d) => d >= 1 && d <= 31))].sort(
    (a, b) => a - b
  );
  if (days.length === 0) return from;

  const { jy, jm, jd } = parseYmd(from);
  for (const day of days) {
    const candidate = jalaliDateFromDay(jy, jm, day);
    const candDay = parseYmd(candidate).jd;
    if (jd <= candDay) return candidate;
  }

  return advanceMonthlyByDay(jalaliDateFromDay(jy, jm, days[0]!), days[0]!);
}

export function normalizePaymentDaysInput(
  paymentDays: number[] | null | undefined,
  dayOfMonth: number
): number[] {
  if (paymentDays && paymentDays.length > 0) {
    return [...new Set(paymentDays.map((d) => Math.round(d)).filter((d) => d >= 1 && d <= 31))].sort(
      (a, b) => a - b
    );
  }
  return [dayOfMonth];
}

export function sameMonthYm(a: string, b: string): boolean {
  return jalaliYearMonth(a) === jalaliYearMonth(b);
}
