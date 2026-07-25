"use client";

import api from "@/services/api";

export type MonthlyReport = {
  accountId: string | null;
  labels: string[];
  income: number[];
  expense: number[];
  net: number[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    totalNet: number;
    months: number;
  };
};

export type CategoryReport = {
  accountId: string | null;
  month: number;
  year: number;
  expense: Array<{ categoryId: string; name: string; color?: string; amount: number }>;
  income: Array<{ categoryId: string; name: string; color?: string; amount: number }>;
  expenseTotal: number;
  incomeTotal: number;
  topExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    date: string;
    category: string;
    account: string;
  }>;
};

export type DebtReportFilter = "all" | "liability" | "receivable" | "overdue";

export type DebtSettlementInstallment = {
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
  settlementPlan: DebtSettlementInstallment[];
  planIsPreview: boolean;
};

export type DebtReport = {
  asOf: string;
  filter: DebtReportFilter;
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

function withAccount(qs: URLSearchParams, accountId?: string | null) {
  if (accountId) qs.set("accountId", accountId);
}

export async function fetchMonthlyReport(params?: {
  months?: number;
  accountId?: string | null;
}): Promise<MonthlyReport> {
  const qs = new URLSearchParams({ months: String(params?.months ?? 6) });
  withAccount(qs, params?.accountId);
  const res = await api.get(`/api/reports/monthly?${qs.toString()}`);
  return res.data.data as MonthlyReport;
}

export async function fetchCategoryReport(params?: {
  month?: number;
  year?: number;
  accountId?: string | null;
}): Promise<CategoryReport> {
  const qs = new URLSearchParams();
  if (params?.month) qs.set("month", String(params.month));
  if (params?.year) qs.set("year", String(params.year));
  withAccount(qs, params?.accountId);
  const res = await api.get(`/api/reports/categories?${qs.toString()}`);
  return res.data.data as CategoryReport;
}

export async function fetchDebtReport(params?: {
  filter?: DebtReportFilter;
}): Promise<DebtReport> {
  const qs = new URLSearchParams();
  if (params?.filter && params.filter !== "all") qs.set("filter", params.filter);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await api.get(`/api/reports/debts${suffix}`);
  return res.data.data as DebtReport;
}
