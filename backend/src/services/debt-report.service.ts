import mongoose from "mongoose";
import jalaali from "jalaali-js";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { TransactionModel } from "../models/Transaction";
import {
  belongsToReportMonth,
  computePaidThisMonth,
} from "./recurring-month.service";
import {
  advanceMonthlyByDay,
  isDueOnOrBefore,
  jalaliDateFromDay,
  jalaliDaysUntil,
  todayJalali,
} from "../utils/jalaliDate";
import { normalizeJalaliDate } from "../utils/normalizeDigits";

export type DebtReportFilter = "all" | "liability" | "receivable" | "overdue";

export type SettlementInstallment = {
  date: string;
  amount: number;
  index: number;
};

export type DebtReportItem = {
  id: string;
  title: string;
  role: "liability" | "receivable";
  type: "income" | "expense";
  kind: "recurring" | "one_time";
  amount: number;
  baseAmount: number;
  estimatedRemaining: number | null;
  remainingInstallments: number | null;
  endMode: "forever" | "months" | null;
  endMonths: number | null;
  paymentsMade: number;
  dayOfMonth: number | null;
  nextPaymentDate: string;
  daysUntil: number;
  isOverdue: boolean;
  notes: string;
  category: { id: string; name: string; color?: string } | null;
  settlementPlan: SettlementInstallment[];
  planIsPreview: boolean;
};

export type DebtMonthBucket = {
  total: number;
  done: number;
  remaining: number;
  totalCount: number;
  doneCount: number;
  remainingCount: number;
};

export type DebtMonthItem = {
  id: string;
  title: string;
  role: "liability" | "receivable";
  type: "income" | "expense";
  kind: "recurring" | "one_time";
  amount: number;
  paid: boolean;
  nextPaymentDate: string;
  category: { id: string; name: string; color?: string } | null;
};

export type DebtReportResult = {
  asOf: string;
  filter: DebtReportFilter;
  month: {
    year: number;
    month: number;
    label: string;
  };
  monthSummary: {
    liabilities: DebtMonthBucket;
    receivables: DebtMonthBucket;
  };
  monthItems: DebtMonthItem[];
  summary: {
    liabilitiesDue: number;
    receivablesDue: number;
    netDue: number;
    estimatedLiabilities: number;
    estimatedReceivables: number;
    estimatedNet: number;
    overdueCount: number;
    overdueAmount: number;
    liabilityCount: number;
    receivableCount: number;
    openCount: number;
  };
  items: DebtReportItem[];
};

const FOREVER_PREVIEW_MONTHS = 6;

function dayFromDate(date: string): number {
  const normalized = normalizeJalaliDate(date);
  const day = Number(normalized.split("/")[2]);
  return Number.isFinite(day) && day >= 1 ? day : 1;
}

function padMonth(month: number): string {
  return String(month).padStart(2, "0");
}

function monthRefDate(year: number, month: number): string {
  const today = todayJalali();
  const [ty, tm] = today.split("/").map(Number);
  if (ty === year && tm === month) return today;
  const len = jalaali.jalaaliMonthLength(year, month);
  return jalaliDateFromDay(year, month, len);
}

function emptyBucket(): DebtMonthBucket {
  return {
    total: 0,
    done: 0,
    remaining: 0,
    totalCount: 0,
    doneCount: 0,
    remainingCount: 0,
  };
}

function monthItemAmount(input: {
  amount: number;
  baseAmount: number;
  kind: "recurring" | "one_time";
  paid: boolean;
}): number {
  if (input.paid && input.kind === "recurring" && input.baseAmount > 0) {
    return input.baseAmount;
  }
  return input.amount;
}

function buildSettlementPlan(input: {
  kind: "recurring" | "one_time";
  amount: number;
  baseAmount: number;
  nextPaymentDate: string;
  dayOfMonth: number | null;
  endMode: "forever" | "months" | null;
  endMonths: number | null;
  paymentsMade: number;
}): { plan: SettlementInstallment[]; planIsPreview: boolean; remainingInstallments: number | null } {
  const nextDate = normalizeJalaliDate(input.nextPaymentDate);

  if (input.kind === "one_time") {
    return {
      plan: [{ date: nextDate, amount: input.amount, index: 1 }],
      planIsPreview: false,
      remainingInstallments: 1,
    };
  }

  const dayOfMonth = input.dayOfMonth ?? dayFromDate(nextDate);
  const base = input.baseAmount > 0 ? input.baseAmount : input.amount;

  if (input.endMode === "months" && input.endMonths != null && input.endMonths > 0) {
    const remaining = Math.max(0, input.endMonths - input.paymentsMade);
    const plan: SettlementInstallment[] = [];
    let date = nextDate;
    for (let i = 0; i < remaining; i++) {
      plan.push({
        date,
        amount: i === 0 ? input.amount : base,
        index: input.paymentsMade + i + 1,
      });
      date = advanceMonthlyByDay(date, dayOfMonth);
    }
    return { plan, planIsPreview: false, remainingInstallments: remaining };
  }

  const plan: SettlementInstallment[] = [];
  let date = nextDate;
  for (let i = 0; i < FOREVER_PREVIEW_MONTHS; i++) {
    plan.push({
      date,
      amount: i === 0 ? input.amount : base,
      index: input.paymentsMade + i + 1,
    });
    date = advanceMonthlyByDay(date, dayOfMonth);
  }
  return { plan, planIsPreview: true, remainingInstallments: null };
}

function estimateRemaining(
  kind: "recurring" | "one_time",
  amount: number,
  baseAmount: number,
  endMode: "forever" | "months" | null,
  endMonths: number | null,
  paymentsMade: number
): number | null {
  if (kind === "one_time") return amount;
  if (endMode === "months" && endMonths != null && endMonths > 0) {
    const remaining = Math.max(0, endMonths - paymentsMade);
    if (remaining === 0) return 0;
    const base = baseAmount > 0 ? baseAmount : amount;
    return amount + Math.max(0, remaining - 1) * base;
  }
  return null;
}

function mapCategory(categoryId: unknown): DebtReportItem["category"] {
  if (
    categoryId &&
    typeof categoryId === "object" &&
    "_id" in categoryId &&
    "name" in categoryId
  ) {
    const cat = categoryId as { _id: unknown; name?: string; color?: string };
    return {
      id: String(cat._id),
      name: cat.name ?? "نامشخص",
      color: cat.color,
    };
  }
  if (categoryId) return { id: String(categoryId), name: "نامشخص" };
  return null;
}

async function settledAmountsByRecurring(
  userId: string | mongoose.Types.ObjectId,
  year: number,
  month: number
): Promise<Map<string, number>> {
  const prefix = `${year}/${padMonth(month)}/`;
  const rows = await TransactionModel.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        settledRecurringId: { $ne: null },
        date: { $regex: `^${prefix}` },
      },
    },
    {
      $group: {
        _id: "$settledRecurringId",
        sum: { $sum: "$amount" },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row._id) map.set(String(row._id), Number(row.sum) || 0);
  }
  return map;
}

export async function buildDebtReport(
  userId: string | mongoose.Types.ObjectId,
  filter: DebtReportFilter = "all",
  monthYear?: { year: number; month: number }
): Promise<DebtReportResult> {
  const today = todayJalali();
  const [ty, tm] = today.split("/").map(Number);
  const year = monthYear?.year ?? ty!;
  const month = monthYear?.month ?? tm!;
  const refDate = monthRefDate(year, month);
  const monthLabel = `${year}/${padMonth(month)}`;

  const [activeRows, monthRows, settledMap] = await Promise.all([
    RecurringTransactionModel.find({
      userId,
      active: true,
      $or: [{ investmentId: { $exists: false } }, { investmentId: null }],
    })
      .populate({ path: "categoryId", select: "name color" })
      .sort({ nextPaymentDate: 1 })
      .lean(),
    RecurringTransactionModel.find({ userId })
      .populate({ path: "categoryId", select: "name color" })
      .lean(),
    settledAmountsByRecurring(userId, year, month),
  ]);

  const items: DebtReportItem[] = [];

  for (const row of activeRows) {
    const kind = (row.kind as "recurring" | "one_time" | undefined) ?? "recurring";
    const type = row.type as "income" | "expense";
    const role: "liability" | "receivable" = type === "expense" ? "liability" : "receivable";
    const amount = Number(row.amount) || 0;
    const baseAmount = Number(row.baseAmount ?? row.amount) || 0;
    const endMode =
      (row.endMode as "forever" | "months" | undefined) ??
      (kind === "recurring" ? "forever" : null);
    const endMonths = row.endMonths ?? null;
    const paymentsMade = row.paymentsMade ?? 0;
    const nextPaymentDate = normalizeJalaliDate(String(row.nextPaymentDate));
    const daysUntil = jalaliDaysUntil(nextPaymentDate, today);
    const isOverdue = isDueOnOrBefore(nextPaymentDate, today);

    const { plan, planIsPreview, remainingInstallments } = buildSettlementPlan({
      kind,
      amount,
      baseAmount,
      nextPaymentDate,
      dayOfMonth: row.dayOfMonth ?? null,
      endMode,
      endMonths,
      paymentsMade,
    });

    const estimatedRemaining = estimateRemaining(
      kind,
      amount,
      baseAmount,
      endMode,
      endMonths,
      paymentsMade
    );

    items.push({
      id: String(row._id),
      title: row.title,
      role,
      type,
      kind,
      amount,
      baseAmount,
      estimatedRemaining,
      remainingInstallments,
      endMode,
      endMonths,
      paymentsMade,
      dayOfMonth: row.dayOfMonth ?? null,
      nextPaymentDate,
      daysUntil,
      isOverdue,
      notes: row.notes ?? "",
      category: mapCategory(row.categoryId),
      settlementPlan: plan,
      planIsPreview,
    });
  }

  const filtered = items.filter((item) => {
    if (filter === "liability") return item.role === "liability";
    if (filter === "receivable") return item.role === "receivable";
    if (filter === "overdue") return item.isOverdue;
    return true;
  });

  let liabilitiesDue = 0;
  let receivablesDue = 0;
  let estimatedLiabilities = 0;
  let estimatedReceivables = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let liabilityCount = 0;
  let receivableCount = 0;

  for (const item of items) {
    if (item.role === "liability") {
      liabilityCount += 1;
      liabilitiesDue += item.amount;
      estimatedLiabilities += item.estimatedRemaining ?? item.amount;
    } else {
      receivableCount += 1;
      receivablesDue += item.amount;
      estimatedReceivables += item.estimatedRemaining ?? item.amount;
    }
    if (item.isOverdue) {
      overdueCount += 1;
      overdueAmount += item.amount;
    }
  }

  const liabilities = emptyBucket();
  const receivables = emptyBucket();
  const monthItems: DebtMonthItem[] = [];

  for (const row of monthRows) {
    const kind = (row.kind as "recurring" | "one_time" | undefined) ?? "recurring";
    const checklistFields = {
      kind,
      active: row.active,
      dayOfMonth: row.dayOfMonth ?? null,
      lastPaymentDate: row.lastPaymentDate ?? null,
      nextPaymentDate: normalizeJalaliDate(String(row.nextPaymentDate)),
      paymentsMade: row.paymentsMade ?? 0,
    };
    if (!belongsToReportMonth(checklistFields, refDate)) continue;

    const paid = computePaidThisMonth(checklistFields, refDate);
    const type = row.type as "income" | "expense";
    const role: "liability" | "receivable" = type === "expense" ? "liability" : "receivable";
    const amountRaw = Number(row.amount) || 0;
    const baseAmount = Number(row.baseAmount ?? row.amount) || 0;
    const settled = settledMap.get(String(row._id));
    const amount =
      paid && settled != null && settled > 0
        ? settled
        : monthItemAmount({ amount: amountRaw, baseAmount, kind, paid });

    const bucket = role === "liability" ? liabilities : receivables;
    bucket.total += amount;
    bucket.totalCount += 1;
    if (paid) {
      bucket.done += amount;
      bucket.doneCount += 1;
    } else {
      bucket.remaining += amount;
      bucket.remainingCount += 1;
    }

    monthItems.push({
      id: String(row._id),
      title: row.title,
      role,
      type,
      kind,
      amount,
      paid,
      nextPaymentDate: checklistFields.nextPaymentDate,
      category: mapCategory(row.categoryId),
    });
  }

  monthItems.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    if (a.role !== b.role) return a.role === "liability" ? -1 : 1;
    return a.nextPaymentDate.localeCompare(b.nextPaymentDate);
  });

  return {
    asOf: today,
    filter,
    month: { year, month, label: monthLabel },
    monthSummary: { liabilities, receivables },
    monthItems,
    summary: {
      liabilitiesDue,
      receivablesDue,
      netDue: receivablesDue - liabilitiesDue,
      estimatedLiabilities,
      estimatedReceivables,
      estimatedNet: estimatedReceivables - estimatedLiabilities,
      overdueCount,
      overdueAmount,
      liabilityCount,
      receivableCount,
      openCount: items.length,
    },
    items: filtered,
  };
}
