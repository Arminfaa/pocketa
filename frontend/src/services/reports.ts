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
