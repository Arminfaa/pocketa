import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";
import {
  isSameJalaliMonth,
  jalaliDateFromDay,
  jalaliYearMonth,
  todayJalali,
} from "../utils/jalaliDate";

function parseYm(today: string): { jy: number; jm: number } {
  const [y, m] = normalizeJalaliDate(toEnglishDigits(today)).split("/").map(Number);
  return { jy: y!, jm: m! };
}

export type MonthChecklistFields = {
  kind?: string | null;
  active: boolean;
  dayOfMonth?: number | null;
  lastPaymentDate?: string | null;
  nextPaymentDate: string;
  paymentsMade?: number | null;
};

/** True if this month's installment/debt has already been paid or postponed past this month. */
export function computePaidThisMonth(
  item: MonthChecklistFields,
  today: string = todayJalali()
): boolean {
  const kind = (item.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  const lastPaymentDate = item.lastPaymentDate
    ? normalizeJalaliDate(item.lastPaymentDate)
    : null;

  if (lastPaymentDate && isSameJalaliMonth(lastPaymentDate, today)) {
    return true;
  }

  if (kind === "one_time") {
    return (
      !item.active &&
      (item.paymentsMade ?? 0) > 0 &&
      isSameJalaliMonth(item.nextPaymentDate, today)
    );
  }

  // قسط: موعد بعدی از موعد همین ماه جلوتر + حداقل یک پرداخت
  const { jy, jm } = parseYm(today);
  const dayOfMonth =
    item.dayOfMonth ??
    Number(normalizeJalaliDate(toEnglishDigits(item.nextPaymentDate)).split("/")[2]);
  if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1) return false;
  if ((item.paymentsMade ?? 0) < 1) return false;

  const thisMonthDue = jalaliDateFromDay(jy, jm, dayOfMonth);
  return normalizeJalaliDate(item.nextPaymentDate) > normalizeJalaliDate(thisMonthDue);
}

export function belongsToMonthChecklist(
  item: MonthChecklistFields & { paidThisMonth: boolean },
  today: string = todayJalali()
): boolean {
  const kind = (item.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  const currentYm = jalaliYearMonth(today);

  if (kind === "one_time") {
    return jalaliYearMonth(item.nextPaymentDate) === currentYm;
  }

  if (item.paidThisMonth) return true;
  if (!item.active) return false;
  // هنوز موعد همین ماه یا عقب‌افتاده دارد
  return jalaliYearMonth(item.nextPaymentDate) <= currentYm;
}

/**
 * Month dues are "clear" when every item on this month's checklist is paid
 * (or postponed out of the month). Empty checklist also counts as clear.
 */
export function isMonthChecklistClear(
  items: MonthChecklistFields[],
  today: string = todayJalali()
): boolean {
  const checklist = items
    .map((item) => ({
      ...item,
      paidThisMonth: computePaidThisMonth(item, today),
    }))
    .filter((item) => belongsToMonthChecklist(item, today));

  return checklist.every((item) => item.paidThisMonth);
}
