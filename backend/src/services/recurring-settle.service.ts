import { AppError } from "../utils/AppError";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import { todayJalali } from "../utils/jalaliDate";
import {
  advancePaymentSchedule,
  currentStageDueAmount,
  resolveMonthlyAmount,
} from "./recurring-stages.service";

export type SettleSnapshot = {
  recurringId: string;
  previousAmount: number;
  previousBaseAmount: number;
  previousNextPaymentDate: string;
  previousActive: boolean;
  previousPaymentsMade: number;
  previousLastPaymentDate: string | null;
  previousLastSettledAmount: number | null;
  deferredDebtId: string | null;
  settleMode: "full" | "partial";
};

type RecurringLike = {
  _id: unknown;
  amount: number;
  baseAmount?: number | null;
  nextPaymentDate: string;
  active: boolean;
  paymentsMade?: number | null;
  lastPaymentDate?: string | null;
  lastSettledAmount?: number | null;
};

export function captureSettleSnapshot(
  recurring: RecurringLike,
  settleMode: "full" | "partial"
): SettleSnapshot {
  return {
    recurringId: String(recurring._id),
    previousAmount: recurring.amount,
    previousBaseAmount: resolveBaseAmount(recurring),
    previousNextPaymentDate: recurring.nextPaymentDate,
    previousActive: recurring.active,
    previousPaymentsMade: recurring.paymentsMade ?? 0,
    previousLastPaymentDate: recurring.lastPaymentDate ?? null,
    previousLastSettledAmount: recurring.lastSettledAmount ?? null,
    deferredDebtId: null,
    settleMode,
  };
}

function resolveBaseAmount(recurring: { amount: number; baseAmount?: number | null }) {
  return resolveMonthlyAmount(recurring);
}

async function createDeferredOneTimeDebt(
  userId: string,
  recurring: {
    title: string;
    type: "income" | "expense";
    categoryId: import("mongoose").Types.ObjectId;
    reminderHour?: number | null;
    notes?: string | null;
  },
  amount: number,
  dueDate: string
) {
  const partialWord = recurring.type === "income" ? "دریافت جزئی" : "پرداخت جزئی";
  return RecurringTransactionModel.create({
    userId,
    title: `مانده — ${recurring.title}`,
    amount,
    baseAmount: amount,
    type: recurring.type,
    kind: "one_time",
    categoryId: recurring.categoryId,
    notes: recurring.notes
      ? `${recurring.notes} (مانده ${partialWord} تا ${dueDate})`
      : `مانده ${partialWord} تا ${dueDate}`,
    active: true,
    paymentsMade: 0,
    reminderHour: recurring.reminderHour ?? 20,
    reminderSentKeys: [],
    nextPaymentDate: normalizeJalaliDate(dueDate),
  });
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
  /** Required for partial — due date for the remaining amount */
  remainderDueDate?: string | null;
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

  const dueAmount = currentStageDueAmount(recurring);
  const paid = input.paidAmount;
  const kind = recurring.kind ?? "recurring";
  const baseAmount = resolveBaseAmount(recurring);

  const snapshot = captureSettleSnapshot(recurring, input.mode);

  if (input.mode === "full") {
    if (Math.round(paid) !== Math.round(dueAmount)) {
      throw new AppError(
        400,
        `تسویه کامل نیست؛ مبلغ تراکنش (${Math.round(paid).toLocaleString("en-US")} تومان) با مبلغ سررسید (${Math.round(dueAmount).toLocaleString("en-US")} تومان) یکی نیست`
      );
    }

    recurring.lastPaymentDate = todayJalali();
    recurring.lastSettledAmount = Math.round(paid);
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    if (kind === "one_time") {
      recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
      recurring.active = false;
    } else {
      advancePaymentSchedule(recurring, { countMonth: true });
    }
    await recurring.save();

    return {
      recurring,
      deferredDebt: null,
      settled: "full" as const,
      snapshot,
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
    throw new AppError(
      400,
      recurring.type === "income"
        ? "مبلغ دریافت جزئی معتبر نیست"
        : "مبلغ پرداخت جزئی معتبر نیست"
    );
  }
  if (!input.remainderDueDate) {
    throw new AppError(400, "تاریخ تسویه مانده را وارد کنید");
  }

  const remainder = dueAmount - paid;
  const remainderDate = normalizeJalaliDate(input.remainderDueDate);

  const deferredDebt = await createDeferredOneTimeDebt(
    input.userId,
    recurring,
    remainder,
    remainderDate
  );
  snapshot.deferredDebtId = String(deferredDebt._id);

  recurring.lastPaymentDate = todayJalali();
  recurring.lastSettledAmount = Math.round(paid);
  recurring.amount = baseAmount;
  recurring.baseAmount = baseAmount;
  if (kind === "one_time") {
    recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    recurring.active = false;
  } else {
    advancePaymentSchedule(recurring, { countMonth: true });
  }
  await recurring.save();

  const partialWord = recurring.type === "income" ? "دریافت جزئی" : "پرداخت جزئی";
  const singularLabel = recurring.type === "income" ? "طلب" : "بدهی";

  return {
    recurring,
    deferredDebt,
    settled: "partial" as const,
    remainder,
    snapshot,
    message: `${partialWord} ثبت شد؛ مانده ${Math.round(remainder).toLocaleString("en-US")} تومان تا ${remainderDate} به‌صورت ${singularLabel} جدا ثبت شد`,
  };
}

/** Reverse a settle applied by a transaction that is being deleted. */
export async function unwindSettleFromSnapshot(
  userId: string,
  snapshot: SettleSnapshot
): Promise<void> {
  const recurring = await RecurringTransactionModel.findOne({
    _id: snapshot.recurringId,
    userId,
  });
  if (recurring) {
    recurring.amount = snapshot.previousAmount;
    recurring.baseAmount = snapshot.previousBaseAmount;
    recurring.nextPaymentDate = snapshot.previousNextPaymentDate;
    recurring.active = snapshot.previousActive;
    recurring.paymentsMade = snapshot.previousPaymentsMade;
    recurring.lastPaymentDate = snapshot.previousLastPaymentDate ?? undefined;
    recurring.lastSettledAmount =
      snapshot.previousLastSettledAmount != null && snapshot.previousLastSettledAmount > 0
        ? snapshot.previousLastSettledAmount
        : undefined;
    await recurring.save();
  }

  if (snapshot.deferredDebtId) {
    const deferred = await RecurringTransactionModel.findOne({
      _id: snapshot.deferredDebtId,
      userId,
    });
    // Only remove if never paid
    if (deferred && (deferred.paymentsMade ?? 0) === 0) {
      await RecurringTransactionModel.deleteOne({ _id: deferred._id });
    }
  }
}
