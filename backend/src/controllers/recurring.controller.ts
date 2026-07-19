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
import { getMarketPrices } from "../services/market-prices.service";
import {
  belongsToMonthChecklist,
  computePaidThisMonth,
} from "../services/recurring-month.service";
import {
  advanceJalaliDate,
  advanceMonthlyByDay,
  isDueOnOrBefore,
  jalaliDateFromDay,
  jalaliYearMonth,
  nextOccurrenceFromDayOfMonth,
  todayJalali,
  type Frequency,
} from "../utils/jalaliDate";
import { normalizeJalaliDate } from "../utils/normalizeDigits";

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
  investmentId?: unknown;
  assetQuantity?: number | null;
  assetType?: string | null;
  scheduleFrequency?: string | null;
  endDate?: string | null;
  liveAmount?: number | null;
}, today: string) {
  const kind = (item.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  const lastPaymentDate = item.lastPaymentDate
    ? normalizeJalaliDate(item.lastPaymentDate)
    : null;
  const paidThisMonth = computePaidThisMonth(item, today);
  const baseAmount = item.baseAmount ?? item.amount;
  const amount = item.liveAmount ?? item.amount;
  return {
    id: item._id,
    title: item.title,
    amount,
    baseAmount: item.liveAmount ?? baseAmount,
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
    investmentId: item.investmentId ?? null,
    assetQuantity: item.assetQuantity ?? null,
    assetType: item.assetType ?? null,
    scheduleFrequency: item.scheduleFrequency ?? "monthly",
    endDate: item.endDate ?? "",
  };
}

function resolveAssetLinkedAmount(
  item: {
    amount: number;
    assetQuantity?: number | null;
    assetType?: string | null;
    goldKind?: string | null;
  },
  market: Awaited<ReturnType<typeof getMarketPrices>> | null
): number {
  const qty = item.assetQuantity;
  const assetType = item.assetType;
  if (
    qty == null ||
    qty <= 0 ||
    (assetType !== "gold" && assetType !== "usd" && assetType !== "rial")
  ) {
    return item.amount;
  }

  if (assetType === "rial") {
    return Math.max(1, Math.round(qty));
  }

  if (!market) return item.amount;

  const unit =
    assetType === "usd"
      ? market.currency?.usdFreeToman
      : item.goldKind === "quarter_coin"
        ? market.gold?.quarterCoinToman
        : market.gold?.gram18kToman;
  if (unit == null || unit <= 0) return item.amount;
  return Math.max(1, Math.round(qty * unit));
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const activeOnly = String(req.query.activeOnly ?? "true") !== "false";

  const allItems = await RecurringTransactionModel.find({ userId })
    .sort({ nextPaymentDate: 1 })
    .populate({ path: "categoryId", select: "name color type icon" })
    .lean();

  let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
  try {
    market = await getMarketPrices();
  } catch {
    market = null;
  }

  const today = todayJalali();
  const toMapped = (item: (typeof allItems)[number]) => {
    const liveAmount = resolveAssetLinkedAmount(item, market);
    return mapItem(
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
        investmentId: item.investmentId,
        assetQuantity: item.assetQuantity,
        assetType: item.assetType,
        scheduleFrequency: item.scheduleFrequency,
        endDate: item.endDate,
        liveAmount,
      },
      today
    );
  };

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
  scheduleFrequency?: string | null;
  endDate?: string | null;
  assetQuantity?: number | null;
  assetType?: string | null;
  amount: number;
  baseAmount?: number | null;
}) {
  const kind = recurring.kind ?? "recurring";
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

  // سود سرمایه‌گذاری: مبلغ را با قیمت روز طلا/دلار به‌روز کن
  if (recurring.assetQuantity && recurring.assetType) {
    let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
    try {
      market = await getMarketPrices();
    } catch {
      market = null;
    }
    const priced = resolveAssetLinkedAmount(recurring, market);
    recurring.amount = priced;
    recurring.baseAmount = priced;
  }

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

    // Postponed due amount becomes a one-time debt only — do NOT also roll it
    // into next month's installment (that double-counted the liability).
    deferredDebt = await createDeferredOneTimeDebt(
      userId,
      recurring,
      dueAmount,
      deferDate,
      `تعویق قسط به ${deferDate}`,
      "تعویق"
    );

    recurring.amount = baseAmount;
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
      `قسط تعویق شد؛ بدهی جدا به مبلغ ${Math.round(dueAmount).toLocaleString("en-US")} تومان ثبت شد و قسط بعدی ${Math.round(baseAmount).toLocaleString("en-US")} تومان است`
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
