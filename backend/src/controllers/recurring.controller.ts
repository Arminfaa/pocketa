import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { BankAccountModel } from "../models/BankAccount";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import {
  RecurringCreateSchema,
  RecurringGenerateSchema,
  RecurringUpdateSchema,
} from "../validations/recurring";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";
import {
  advanceMonthlyByDay,
  isDueOnOrBefore,
  isSameJalaliMonth,
  jalaliDateFromDay,
  jalaliYearMonth,
  nextOccurrenceFromDayOfMonth,
  todayJalali,
} from "../utils/jalaliDate";

function parseYm(today: string): { jy: number; jm: number } {
  const [y, m] = normalizeJalaliDate(toEnglishDigits(today)).split("/").map(Number);
  return { jy: y!, jm: m! };
}

/** True if this month's installment/debt has already been paid. */
function computePaidThisMonth(item: {
  kind?: string;
  active: boolean;
  dayOfMonth?: number | null;
  lastPaymentDate?: string | null;
  nextPaymentDate: string;
  paymentsMade?: number | null;
}, today: string): boolean {
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

function mapItem(item: {
  _id: unknown;
  title: string;
  amount: number;
  baseAmount?: number | null;
  type: string;
  kind?: string;
  dayOfMonth?: number | null;
  endMode?: string | null;
  endMonths?: number | null;
  paymentsMade?: number | null;
  lastPaymentDate?: string | null;
  nextPaymentDate: string;
  active: boolean;
  notes?: string | null;
  reminderHour?: number | null;
  categoryId: unknown;
  createdAt?: Date;
}, today: string) {
  const kind = (item.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  const lastPaymentDate = item.lastPaymentDate
    ? normalizeJalaliDate(item.lastPaymentDate)
    : null;
  const paidThisMonth = computePaidThisMonth(item, today);
  const baseAmount = item.baseAmount ?? item.amount;
  return {
    id: item._id,
    title: item.title,
    amount: item.amount,
    baseAmount,
    type: item.type,
    kind,
    dayOfMonth: item.dayOfMonth ?? null,
    endMode: item.endMode ?? (kind === "recurring" ? "forever" : null),
    endMonths: item.endMonths ?? null,
    paymentsMade: item.paymentsMade ?? 0,
    lastPaymentDate,
    reminderHour: item.reminderHour ?? 20,
    nextPaymentDate: item.nextPaymentDate,
    active: item.active,
    notes: item.notes ?? "",
    category: item.categoryId,
    isDue: item.active && isDueOnOrBefore(item.nextPaymentDate, today),
    paidThisMonth,
    createdAt: item.createdAt,
  };
}

function belongsToMonthChecklist(
  item: {
    kind?: string;
    active: boolean;
    nextPaymentDate: string;
    paidThisMonth: boolean;
  },
  today: string
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

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const activeOnly = String(req.query.activeOnly ?? "true") !== "false";

  const allItems = await RecurringTransactionModel.find({ userId })
    .sort({ nextPaymentDate: 1 })
    .populate({ path: "categoryId", select: "name color type icon" });

  const today = todayJalali();
  const toMapped = (item: (typeof allItems)[number]) =>
    mapItem(
      {
        _id: item._id,
        title: item.title,
        amount: item.amount,
        baseAmount: item.baseAmount,
        type: item.type,
        kind: item.kind,
        dayOfMonth: item.dayOfMonth,
        endMode: item.endMode,
        endMonths: item.endMonths,
        paymentsMade: item.paymentsMade,
        lastPaymentDate: item.lastPaymentDate,
        reminderHour: item.reminderHour,
        nextPaymentDate: item.nextPaymentDate,
        active: item.active,
        notes: item.notes,
        categoryId: item.categoryId,
        createdAt: (item as { createdAt?: Date }).createdAt,
      },
      today
    );

  const mappedAll = allItems.map(toMapped);
  const mapped = activeOnly ? mappedAll.filter((i) => i.active) : mappedAll;
  const monthChecklist = mappedAll
    .filter((item) => belongsToMonthChecklist(item, today))
    .sort((a, b) => {
      if (a.paidThisMonth !== b.paidThisMonth) return a.paidThisMonth ? 1 : -1;
      return a.nextPaymentDate.localeCompare(b.nextPaymentDate);
    });

  const [y, m] = today.split("/").map(Number);

  return sendSuccess(res, {
    items: mapped,
    monthChecklist,
    monthLabel: jalaliDateFromDay(y!, m!, 1).slice(0, 7),
    dueCount: mapped.filter((i) => i.isDue).length,
    today,
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = RecurringCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  if (category.type !== parsed.data.type) {
    throw new AppError(400, "نوع دسته با نوع تراکنش همخوانی ندارد");
  }

  const base = {
    userId,
    title: parsed.data.title,
    amount: parsed.data.amount,
    baseAmount: parsed.data.amount,
    type: parsed.data.type,
    categoryId: parsed.data.categoryId,
    notes: parsed.data.notes ?? "",
    active: parsed.data.active ?? true,
    paymentsMade: 0,
    reminderHour: parsed.data.reminderHour ?? 20,
    reminderSentKeys: [],
  };

  let item;
  if (parsed.data.kind === "recurring") {
    const dayOfMonth = parsed.data.dayOfMonth;
    const endMode = parsed.data.endMode;
    item = await RecurringTransactionModel.create({
      ...base,
      kind: "recurring",
      dayOfMonth,
      endMode,
      endMonths: endMode === "months" ? parsed.data.endMonths : undefined,
      nextPaymentDate: nextOccurrenceFromDayOfMonth(dayOfMonth),
    });
  } else {
    const dueDate = normalizeJalaliDate(parsed.data.dueDate);
    item = await RecurringTransactionModel.create({
      ...base,
      kind: "one_time",
      nextPaymentDate: dueDate,
      endMode: undefined,
      dayOfMonth: undefined,
      endMonths: undefined,
    });
  }

  return sendSuccess(res, { item }, "بدهی/قسط ثبت شد", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = RecurringUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const existing = await RecurringTransactionModel.findOne({ _id: id, userId });
  if (!existing) throw new AppError(404, "مورد یافت نشد");

  if (parsed.data.categoryId) {
    const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
    if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  }

  const next: Record<string, unknown> = { ...parsed.data };
  delete next.dueDate;

  const kind = parsed.data.kind ?? existing.kind ?? "recurring";

  if (kind === "one_time") {
    const due = parsed.data.dueDate ?? parsed.data.nextPaymentDate;
    if (due) next.nextPaymentDate = normalizeJalaliDate(due);
    next.dayOfMonth = undefined;
    next.endMode = undefined;
    next.endMonths = undefined;
  } else {
    const dayOfMonth = parsed.data.dayOfMonth ?? existing.dayOfMonth;
    if (dayOfMonth != null) {
      next.dayOfMonth = dayOfMonth;
      if (parsed.data.dayOfMonth != null || parsed.data.kind === "recurring") {
        next.nextPaymentDate = nextOccurrenceFromDayOfMonth(dayOfMonth);
      }
    }
    if (parsed.data.endMode === "forever") {
      next.endMonths = undefined;
    }
    if (parsed.data.nextPaymentDate) {
      next.nextPaymentDate = normalizeJalaliDate(parsed.data.nextPaymentDate);
    }
  }
  if (parsed.data.notes !== undefined) next.notes = parsed.data.notes ?? "";

  const item = await RecurringTransactionModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: next },
    { returnDocument: "after" }
  );

  return sendSuccess(res, { item });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await RecurringTransactionModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "مورد یافت نشد");

  return sendSuccess(res, { id }, "حذف شد");
});

function resolveBaseAmount(recurring: {
  baseAmount?: number | null;
  amount: number;
}): number {
  const base = recurring.baseAmount;
  return typeof base === "number" && base > 0 ? base : recurring.amount;
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
  dueDate: string,
  noteSuffix: string,
  titlePrefix = "مانده"
) {
  return RecurringTransactionModel.create({
    userId,
    title: `${titlePrefix} — ${recurring.title}`,
    amount,
    baseAmount: amount,
    type: recurring.type,
    kind: "one_time",
    categoryId: recurring.categoryId,
    notes: recurring.notes ? `${recurring.notes} (${noteSuffix})` : noteSuffix,
    active: true,
    paymentsMade: 0,
    reminderHour: recurring.reminderHour ?? 20,
    reminderSentKeys: [],
    nextPaymentDate: normalizeJalaliDate(dueDate),
  });
}

function advanceRecurringSchedule(recurring: {
  kind?: string;
  dayOfMonth?: number | null;
  endMode?: string | null;
  endMonths?: number | null;
  paymentsMade?: number | null;
  nextPaymentDate: string;
  active: boolean;
}) {
  const kind = recurring.kind ?? "recurring";
  if (kind === "one_time") {
    recurring.active = false;
    return;
  }

  const dayOfMonth =
    recurring.dayOfMonth ?? Number(recurring.nextPaymentDate.split("/")[2]);
  const endMode = recurring.endMode ?? "forever";
  const paymentsMade = recurring.paymentsMade ?? 0;
  const reachedEnd =
    endMode === "months" &&
    recurring.endMonths != null &&
    paymentsMade >= recurring.endMonths;

  recurring.nextPaymentDate = advanceMonthlyByDay(recurring.nextPaymentDate, dayOfMonth);
  if (reachedEnd) {
    recurring.active = false;
  }
}

/** Create a real transaction from a due item; advance or close afterward. */
export const generate = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = RecurringGenerateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());
  }

  const { id } = req.params;
  const recurring = await RecurringTransactionModel.findOne({ _id: id, userId, active: true });
  if (!recurring) throw new AppError(404, "بدهی/قسط فعال یافت نشد");

  const mode = parsed.data.mode;
  const kind = recurring.kind ?? "recurring";
  const kindLabel = kind === "one_time" ? "بدهی یک‌باره" : "قسط ماهانه";
  const baseAmount = resolveBaseAmount(recurring);
  const dueAmount = recurring.amount;
  let createdTx = null;
  let deferredDebt = null;

  if (mode === "postpone") {
    const deferDate = normalizeJalaliDate(
      parsed.data.postponeDueDate ?? recurring.nextPaymentDate
    );

    if (kind === "one_time") {
      recurring.nextPaymentDate = deferDate;
      await recurring.save();

      return sendSuccess(
        res,
        {
          transaction: null,
          nextPaymentDate: recurring.nextPaymentDate,
          active: recurring.active,
        },
        `سررسید بدهی به ${deferDate} تعویق شد`
      );
    }

    deferredDebt = await createDeferredOneTimeDebt(
      userId,
      recurring,
      baseAmount,
      deferDate,
      `تعویق قسط به ${deferDate}`,
      "تعویق"
    );

    recurring.amount = dueAmount + baseAmount;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring);

    await recurring.save();

    return sendSuccess(
      res,
      {
        transaction: null,
        deferredDebt,
        nextPaymentDate: recurring.nextPaymentDate,
        nextAmount: recurring.amount,
        active: recurring.active,
      },
      `قسط به ماه بعد منتقل شد (${Math.round(recurring.amount).toLocaleString("en-US")} تومان) و بدهی تعویق ثبت شد`
    );
  }

  const account = await BankAccountModel.findOne({
    _id: parsed.data.accountId,
    userId,
    isActive: true,
  });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  if (mode === "full") {
    createdTx = await TransactionModel.create({
      userId,
      accountId: parsed.data.accountId,
      categoryId: recurring.categoryId,
      type: recurring.type,
      amount: dueAmount,
      title: recurring.title,
      description: recurring.notes || `ثبت از بدهی/اقساط (${kindLabel})`,
      date: normalizeJalaliDate(recurring.nextPaymentDate),
      source: "manual",
      needsReview: false,
    });

    recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    recurring.lastPaymentDate = todayJalali();
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring);
    await recurring.save();

    return sendSuccess(
      res,
      {
        transaction: createdTx,
        nextPaymentDate: recurring.nextPaymentDate,
        nextAmount: recurring.amount,
        active: recurring.active,
        paymentsMade: recurring.paymentsMade,
      },
      kind === "one_time" || !recurring.active
        ? "تراکنش ثبت شد و مورد بسته شد"
        : "تراکنش ثبت شد و موعد بعدی به‌روز شد"
    );
  }

  const paidAmount = parsed.data.paidAmount!;
  if (paidAmount >= dueAmount) {
    throw new AppError(400, "برای تسویه کامل از حالت «تسویه کامل» استفاده کنید");
  }

  const remainder = dueAmount - paidAmount;

  if (parsed.data.remainderHandling === "next_month" && kind !== "recurring") {
    throw new AppError(400, "انتقال مانده به ماه بعد فقط برای اقساط ماهانه است");
  }

  createdTx = await TransactionModel.create({
    userId,
    accountId: parsed.data.accountId,
    categoryId: recurring.categoryId,
    type: recurring.type,
    amount: paidAmount,
    title: `${recurring.title} (پرداخت جزئی)`,
    description:
      recurring.notes ||
      `پرداخت جزئی — مانده ${Math.round(remainder).toLocaleString("en-US")} تومان`,
    date: normalizeJalaliDate(recurring.nextPaymentDate),
    source: "manual",
    needsReview: false,
  });

  recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
  recurring.lastPaymentDate = todayJalali();

  if (parsed.data.remainderHandling === "next_month") {
    recurring.amount = baseAmount + remainder;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring);
  } else {
    const remainderDate = normalizeJalaliDate(parsed.data.remainderDueDate!);
    deferredDebt = await createDeferredOneTimeDebt(
      userId,
      recurring,
      remainder,
      remainderDate,
      `مانده پرداخت جزئی تا ${remainderDate}`
    );
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring);
  }

  await recurring.save();

  return sendSuccess(
    res,
    {
      transaction: createdTx,
      deferredDebt,
      nextPaymentDate: recurring.nextPaymentDate,
      nextAmount: recurring.amount,
      active: recurring.active,
      paymentsMade: recurring.paymentsMade,
    },
    deferredDebt
      ? "پرداخت جزئی ثبت شد و مانده به‌صورت بدهی جدا ثبت شد"
      : "پرداخت جزئی ثبت شد و مانده به قسط ماه بعد اضافه شد"
  );
});
