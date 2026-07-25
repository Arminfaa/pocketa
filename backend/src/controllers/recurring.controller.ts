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
  advanceMonthlyByDay,
  isDueOnOrBefore,
  jalaliDateFromDay,
  nextOccurrenceFromDayOfMonth,
  todayJalali,
} from "../utils/jalaliDate";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import {
  createVarianceTransaction,
  planSettlementVariance,
} from "../services/settlement-variance.service";
import { createDeductionTransactions } from "../services/settlement-deductions.service";
import {
  advancePaymentSchedule,
  currentStageDueAmount,
  currentStageIndex,
  nextOccurrenceFromPaymentDays,
  normalizePaymentDaysInput,
  resolveMonthlyAmount,
  resolvePaymentDays,
  resolveStageAmounts,
} from "../services/recurring-stages.service";

function mapItem(item: {
  _id: unknown;
  title: string;
  amount: number;
  baseAmount?: number | null;
  type: string;
  kind?: string;
  dayOfMonth?: number | null;
  paymentDays?: number[] | null;
  stageAmounts?: number[] | null;
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
  goldKind?: string | null;
  scheduleFrequency?: string | null;
  endDate?: string | null;
  liveAmount?: number | null;
}, today: string) {
  const kind = (item.kind as "recurring" | "one_time" | undefined) ?? "recurring";
  const lastPaymentDate = item.lastPaymentDate
    ? normalizeJalaliDate(item.lastPaymentDate)
    : null;
  const paymentDays = resolvePaymentDays(item);
  const paidThisMonth = computePaidThisMonth(
    { ...item, paymentDays },
    today
  );
  const monthlyBase = item.liveAmount ?? resolveMonthlyAmount(item);
  const stageSource = {
    ...item,
    amount: item.liveAmount ?? item.amount,
    baseAmount: monthlyBase,
    paymentDays,
  };
  const stageAmounts = resolveStageAmounts(stageSource);
  const stageIndex = kind === "recurring" ? currentStageIndex(stageSource) : 0;
  const dueNow =
    kind === "recurring"
      ? currentStageDueAmount(stageSource)
      : item.liveAmount ?? item.amount;

  return {
    id: item._id,
    title: item.title,
    amount: dueNow,
    baseAmount: monthlyBase,
    monthlyAmount: monthlyBase,
    type: item.type,
    kind,
    dayOfMonth: item.dayOfMonth ?? paymentDays[0] ?? null,
    paymentDays,
    stageAmounts,
    currentStageIndex: stageIndex,
    stageCount: paymentDays.length,
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
    goldKind: item.goldKind ?? null,
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
        paymentDays: item.paymentDays,
        stageAmounts: item.stageAmounts,
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
        goldKind: item.goldKind,
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
    ...(parsed.data.assetQuantity != null &&
    parsed.data.assetQuantity > 0 &&
    parsed.data.assetType
      ? {
          assetQuantity: parsed.data.assetQuantity,
          assetType: parsed.data.assetType,
          goldKind:
            parsed.data.assetType === "gold"
              ? (parsed.data.goldKind ?? "melted")
              : undefined,
        }
      : {}),
  };

  let item;
  if (parsed.data.kind === "recurring") {
    const data = parsed.data;
    const paymentDays = normalizePaymentDaysInput(
      data.paymentDays,
      data.dayOfMonth ?? data.paymentDays?.[0] ?? 1
    );
    const dayOfMonth = paymentDays[0]!;
    const endMode = data.endMode;
    const rawStageAmounts = data.stageAmounts;
    const rawPaymentDays = data.paymentDays;

    let stageAmounts: number[] | undefined;
    if (
      rawStageAmounts &&
      rawPaymentDays &&
      rawStageAmounts.length === rawPaymentDays.length
    ) {
      // Keep amounts aligned with days after sorting
      const paired = rawPaymentDays
        .map((day, i) => ({
          day: Math.round(day),
          amount: Math.round(rawStageAmounts[i]!),
        }))
        .filter((p) => p.day >= 1 && p.day <= 31)
        .sort((a, b) => a.day - b.day);
      // Dedupe by day (keep first)
      const seen = new Set<number>();
      stageAmounts = [];
      for (const p of paired) {
        if (seen.has(p.day)) continue;
        seen.add(p.day);
        stageAmounts.push(p.amount);
      }
      if (stageAmounts.length !== paymentDays.length) {
        stageAmounts = undefined;
      }
    } else if (rawStageAmounts && rawStageAmounts.length === paymentDays.length) {
      stageAmounts = rawStageAmounts.map((n) => Math.round(n));
    }

    item = await RecurringTransactionModel.create({
      ...base,
      kind: "recurring",
      dayOfMonth,
      paymentDays,
      stageAmounts,
      endMode,
      endMonths: endMode === "months" ? data.endMonths : undefined,
      nextPaymentDate:
        paymentDays.length > 1
          ? nextOccurrenceFromPaymentDays(paymentDays)
          : nextOccurrenceFromDayOfMonth(dayOfMonth),
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
    const paymentDays =
      parsed.data.paymentDays != null
        ? normalizePaymentDaysInput(
            parsed.data.paymentDays,
            parsed.data.dayOfMonth ?? existing.dayOfMonth ?? 1
          )
        : parsed.data.dayOfMonth != null
          ? normalizePaymentDaysInput(existing.paymentDays, parsed.data.dayOfMonth)
          : null;

    if (paymentDays) {
      next.paymentDays = paymentDays;
      next.dayOfMonth = paymentDays[0];
      if (
        parsed.data.paymentDays != null ||
        parsed.data.dayOfMonth != null ||
        parsed.data.kind === "recurring"
      ) {
        next.nextPaymentDate =
          paymentDays.length > 1
            ? nextOccurrenceFromPaymentDays(paymentDays)
            : nextOccurrenceFromDayOfMonth(paymentDays[0]!);
      }
    } else {
      const dayOfMonth = parsed.data.dayOfMonth ?? existing.dayOfMonth;
      if (dayOfMonth != null) {
        next.dayOfMonth = dayOfMonth;
        if (parsed.data.dayOfMonth != null || parsed.data.kind === "recurring") {
          next.nextPaymentDate = nextOccurrenceFromDayOfMonth(dayOfMonth);
        }
      }
    }

    if (parsed.data.stageAmounts !== undefined) {
      next.stageAmounts =
        parsed.data.stageAmounts && parsed.data.stageAmounts.length > 0
          ? parsed.data.stageAmounts.map((n) => Math.round(n))
          : undefined;
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

function advanceRecurringSchedule(
  recurring: {
    kind?: string;
    dayOfMonth?: number | null;
    paymentDays?: number[] | null;
    stageAmounts?: number[] | null;
    endMode?: string | null;
    endMonths?: number | null;
    paymentsMade?: number | null;
    nextPaymentDate: string;
    active: boolean;
    scheduleFrequency?: string | null;
    endDate?: string | null;
    amount: number;
    baseAmount?: number | null;
  },
  options?: { countMonth?: boolean }
) {
  return advancePaymentSchedule(recurring, options);
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
  const isReceivable = recurring.type === "income";
  const singularLabel = isReceivable ? "طلب" : "بدهی";
  const kindLabel =
    kind === "one_time"
      ? `${singularLabel} یک‌باره`
      : isReceivable
        ? "طلب ماهانه"
        : "قسط ماهانه";

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
  const dueAmount = currentStageDueAmount(recurring);
  const stageIdx = currentStageIndex(recurring);
  const stageCount = resolvePaymentDays(recurring).length;
  const stageLabel =
    stageCount > 1 ? ` (مرحله ${stageIdx + 1} از ${stageCount})` : "";
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
        `سررسید ${singularLabel} به ${deferDate} تعویق شد`
      );
    }

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
    advanceRecurringSchedule(recurring, { countMonth: false });

    await recurring.save();

    const nextDue = currentStageDueAmount(recurring);
    return sendSuccess(
      res,
      {
        transaction: null,
        deferredDebt,
        nextPaymentDate: recurring.nextPaymentDate,
        nextAmount: nextDue,
        active: recurring.active,
      },
      `قسط تعویق شد؛ ${singularLabel} جدا به مبلغ ${Math.round(dueAmount).toLocaleString("en-US")} تومان ثبت شد و موعد بعدی ${Math.round(nextDue).toLocaleString("en-US")} تومان است`
    );
  }

  const account = await BankAccountModel.findOne({
    _id: parsed.data.accountId,
    userId,
    isActive: true,
  });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  if (mode === "full") {
    const deductions = (parsed.data.deductions ?? [])
      .map((d) => ({
        title: d.title.trim(),
        amount: Math.round(d.amount),
        categoryId: d.categoryId ?? null,
      }))
      .filter((d) => d.title.length > 0 && d.amount > 0);

    if (deductions.length > 0 && recurring.type !== "income") {
      throw new AppError(400, "کسورات فقط برای درآمد قابل ثبت است");
    }

    const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
    if (deductionTotal >= dueAmount) {
      throw new AppError(400, "جمع کسورات باید کمتر از مبلغ سررسید باشد");
    }

    const netExpected = dueAmount - deductionTotal;
    const settledRaw = parsed.data.settledAmount;
    const settledAmount =
      settledRaw != null && Number.isFinite(settledRaw) && settledRaw > 0
        ? Math.round(settledRaw)
        : netExpected;

    const plan = planSettlementVariance(
      recurring.type as "income" | "expense",
      netExpected,
      settledAmount
    );

    const txDate = normalizeJalaliDate(recurring.nextPaymentDate);
    const deductionNote =
      deductionTotal > 0
        ? ` | کسورات ${deductionTotal.toLocaleString("en-US")} تومان — خالص ${netExpected.toLocaleString("en-US")}`
        : "";
    const varianceNote = plan.variance
      ? ` | مبلغ واقعی ${plan.settledAmount.toLocaleString("en-US")} تومان` +
        (plan.variance.kind === "fee"
          ? ` (کارمزد ${plan.variance.amount.toLocaleString("en-US")})`
          : plan.variance.kind === "excess_profit"
            ? ` (سود مازاد ${plan.variance.amount.toLocaleString("en-US")})`
            : ` (مابه‌التفاوت قیمت ${plan.variance.amount.toLocaleString("en-US")})`)
      : "";

    const primaryAmount =
      recurring.type === "income" && deductionTotal > 0
        ? dueAmount
        : plan.primaryAmount;

    createdTx = await TransactionModel.create({
      userId,
      accountId: parsed.data.accountId,
      categoryId: recurring.categoryId,
      type: recurring.type,
      amount: primaryAmount,
      title: `${recurring.title}${stageLabel}`,
      description:
        (recurring.notes || `ثبت از ${isReceivable ? "طلب" : "بدهی"}/اقساط (${kindLabel})`) +
        deductionNote +
        varianceNote,
      date: txDate,
      source: "manual",
      needsReview: false,
      tags: [
        ...(plan.variance ? ["تسویه-با-اختلاف"] : []),
        ...(deductionTotal > 0 ? ["با-کسورات"] : []),
        ...(stageCount > 1 ? ["مرحله-پرداخت"] : []),
      ],
      settleSnapshot: {
        expectedAmount: dueAmount,
        settledAmount: plan.settledAmount,
        varianceKind: plan.variance?.kind ?? null,
        varianceAmount: plan.variance?.amount ?? 0,
        deductionTotal,
        netExpected,
      },
    });

    const deductionTxs = await createDeductionTransactions({
      userId,
      accountId: parsed.data.accountId!,
      date: txDate,
      parentTitle: recurring.title,
      linkedTransactionId: createdTx._id,
      deductions,
    });

    const varianceTx = await createVarianceTransaction({
      userId,
      accountId: parsed.data.accountId!,
      date: txDate,
      plan,
      parentTitle: recurring.title,
      linkedTransactionId: createdTx._id,
    });

    if (varianceTx) {
      createdTx.linkedTransactionId = varianceTx._id;
      await createdTx.save();
    } else if (deductionTxs[0]) {
      createdTx.linkedTransactionId = deductionTxs[0]._id;
      await createdTx.save();
    }

    recurring.lastPaymentDate = todayJalali();
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    if (kind === "one_time") {
      recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
      recurring.active = false;
    } else {
      advanceRecurringSchedule(recurring, { countMonth: true });
    }
    await recurring.save();

    const settleMsg = (() => {
      const netMsg =
        deductionTotal > 0
          ? ` با خالص ${plan.settledAmount.toLocaleString("en-US")} تومان`
          : plan.variance
            ? ` با مبلغ واقعی ${plan.settledAmount.toLocaleString("en-US")} تومان`
            : "";
      if (kind === "one_time" || !recurring.active) {
        return `تراکنش${netMsg} ثبت شد و مورد بسته شد`;
      }
      if (stageCount > 1 && stageIdx < stageCount - 1) {
        return `مرحله ${stageIdx + 1} ثبت شد${netMsg}؛ موعد مرحله بعد به‌روز شد`;
      }
      return `تراکنش${netMsg} ثبت شد و موعد بعدی به‌روز شد`;
    })();

    return sendSuccess(
      res,
      {
        transaction: createdTx,
        varianceTransaction: varianceTx,
        deductionTransactions: deductionTxs,
        settledAmount: plan.settledAmount,
        expectedAmount: dueAmount,
        deductionTotal,
        nextPaymentDate: recurring.nextPaymentDate,
        nextAmount: currentStageDueAmount(recurring),
        active: recurring.active,
        paymentsMade: recurring.paymentsMade,
      },
      settleMsg
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
    title: `${recurring.title}${stageLabel} (${isReceivable ? "دریافت جزئی" : "پرداخت جزئی"})`,
    description:
      recurring.notes ||
      `${isReceivable ? "دریافت جزئی" : "پرداخت جزئی"} — مانده ${Math.round(remainder).toLocaleString("en-US")} تومان`,
    date: normalizeJalaliDate(recurring.nextPaymentDate),
    source: "manual",
    needsReview: false,
  });

  recurring.lastPaymentDate = todayJalali();

  if (parsed.data.remainderHandling === "next_month") {
    recurring.amount = baseAmount + remainder;
    recurring.baseAmount = baseAmount;
    const days = resolvePaymentDays(recurring);
    recurring.nextPaymentDate = advanceMonthlyByDay(recurring.nextPaymentDate, days[0]!);
    recurring.paymentsMade = (recurring.paymentsMade ?? 0) + 1;
    const endMode = recurring.endMode ?? "forever";
    if (
      endMode === "months" &&
      recurring.endMonths != null &&
      (recurring.paymentsMade ?? 0) >= recurring.endMonths
    ) {
      recurring.active = false;
    }
  } else {
    const remainderDate = normalizeJalaliDate(parsed.data.remainderDueDate!);
    deferredDebt = await createDeferredOneTimeDebt(
      userId,
      recurring,
      remainder,
      remainderDate,
      `مانده ${isReceivable ? "دریافت" : "پرداخت"} جزئی تا ${remainderDate}`
    );
    recurring.amount = baseAmount;
    recurring.baseAmount = baseAmount;
    advanceRecurringSchedule(recurring, { countMonth: true });
  }

  await recurring.save();

  return sendSuccess(
    res,
    {
      transaction: createdTx,
      deferredDebt,
      nextPaymentDate: recurring.nextPaymentDate,
      nextAmount: currentStageDueAmount(recurring),
      active: recurring.active,
      paymentsMade: recurring.paymentsMade,
    },
    deferredDebt
      ? `${isReceivable ? "دریافت" : "پرداخت"} جزئی ثبت شد و مانده به‌صورت ${singularLabel} جدا ثبت شد`
      : `${isReceivable ? "دریافت" : "پرداخت"} جزئی ثبت شد و مانده به قسط ماه بعد اضافه شد`
  );
});
