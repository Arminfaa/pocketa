import { AppError } from "../utils/AppError";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import {
  advanceJalaliDate,
  advanceMonthlyByDay,
  todayJalali,
  type Frequency,
} from "../utils/jalaliDate";

function resolveBaseAmount(recurring: { amount: number; baseAmount?: number | null }) {
  return recurring.baseAmount ?? recurring.amount;
}

function advanceRecurringSchedule(recurring: {
  kind?: string;
  dayOfMonth?: number | null;
  endMode?: string | null;
  endMonths?: number | null;
  paymentsMade?: number | null;
  nextPaymentDate: string;
  active: boolean;
  scheduleFrequency?: string | null;
  endDate?: string | null;
  amount: number;
  baseAmount?: number | null;
}) {
  const kind = (recurring.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  if (kind === "one_time") {
    recurring.active = false;
    return;
  }

  const frequency = (recurring.scheduleFrequency as Frequency | undefined) ?? "monthly";
  const endMode = recurring.endMode ?? "forever";
  const paymentsMade = recurring.paymentsMade ?? 0;
  const reachedEnd =
    endMode === "months" &&
    recurring.endMonths != null &&
    paymentsMade >= recurring.endMonths;

  if (frequency === "monthly") {
    const dayOfMonth =
      recurring.dayOfMonth ?? Number(recurring.nextPaymentDate.split("/")[2]);
    recurring.nextPaymentDate = advanceMonthlyByDay(recurring.nextPaymentDate, dayOfMonth);
  } else {
    recurring.nextPaymentDate = advanceJalaliDate(recurring.nextPaymentDate, frequency);
  }

  if (reachedEnd) {
    recurring.active = false;
  }

  const endDate = recurring.endDate ? normalizeJalaliDate(recurring.endDate) : "";
  if (endDate && normalizeJalaliDate(recurring.nextPaymentDate) > endDate) {
    recurring.active = false;
  }
}

/**
 * Apply an already-created bank/manual transaction as payment toward an active
 * recurring/due item — does NOT create another transaction.
 */
export async function settleRecurringWithExistingTransaction(input: {
  userId: string;
  recurringId: string;
  /** Must match recurring.type */
  transactionType: "income" | "expense";
  paidAmount: number;
  mode: "full" | "partial";
}) {
  const recurring = await RecurringTransactionModel.findOne({
    _id: input.recurringId,
    userId: input.userId,
    active: true,
  });
  if (!recurring) throw new AppError(404, "سررسید فعال یافت نشد");

  if (recurring.type !== input.transactionType) {
    throw new AppError(
      400,
      input.transactionType === "income"
        ? "برای تراکنش درآمد فقط سررسیدهای از نوع درآمد/طلب قابل انتخاب است"
        : "برای تراکنش هزینه فقط سررسیدهای از نوع هزینه/بدهی قابل انتخاب است"
    );
  }

  const dueAmount = recurring.amount;
  const paid = input.paidAmount;
  const kind = recurring.kind ?? "recurring";
  const baseAmount = resolveBaseAmount(recurring);

  if (input.mode === "full") {
    if (Math.round(paid) !== Math.round(dueAmount)) {
      throw new AppError(
        400,
        `تسویه کامل نیست؛ مبلغ تراکنش (${Math.round(paid).toLocaleString("en-US")} تومان) با مبلغ سررسید (${Math.round(dueAmount).toLocaleString("en-US")} تومان) یکی نیست`
      );
    }

    recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    recurring.lastPaymentDate = todayJalali();
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring);
    await recurring.save();

    return {
      recurring,
      settled: "full" as const,
      message:
        kind === "one_time" || !recurring.active
          ? "تراکنش ثبت و سررسید تسویه کامل شد"
          : "تراکنش ثبت و سررسید تسویه شد؛ موعد بعدی به‌روز شد",
    };
  }

  // partial
  if (paid >= dueAmount) {
    throw new AppError(400, "برای تسویه کامل از حالت «تسویه کامل» استفاده کنید");
  }
  if (paid <= 0) {
    throw new AppError(400, "مبلغ پرداخت جزئی معتبر نیست");
  }

  const remainder = dueAmount - paid;
  recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
  recurring.lastPaymentDate = todayJalali();

  if (kind === "one_time") {
    recurring.amount = remainder;
    recurring.baseAmount = remainder;
    recurring.active = true;
  } else {
    // Keep remainder on the current installment (don't auto-create deferred debt here)
    recurring.amount = remainder;
    recurring.baseAmount = baseAmount;
  }

  await recurring.save();

  return {
    recurring,
    settled: "partial" as const,
    remainder,
    message: `پرداخت جزئی ثبت شد؛ مانده سررسید ${Math.round(remainder).toLocaleString("en-US")} تومان`,
  };
}
