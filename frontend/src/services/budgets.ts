"use client";

import api from "@/services/api";

export type BudgetStatus = "ok" | "warning" | "danger";

export type BudgetItem = {
  id: string;
  amount: number;
  month: number;
  year: number;
  consumed: number;
  percent: number;
  rawPercent: number;
  status: BudgetStatus;
  remaining: number;
  category: {
    _id: string;
    name: string;
    icon?: string;
    color?: string;
    type?: string;
  };
};

export type BudgetsResponse = {
  items: BudgetItem[];
  month: number;
  year: number;
  summary: {
    totalBudget: number;
    totalConsumed: number;
    warningCount: number;
    dangerCount: number;
  };
};

export async function fetchBudgets(params?: {
  month?: number;
  year?: number;
}): Promise<BudgetsResponse> {
  const qs = new URLSearchParams({ limit: "50" });
  if (params?.month) qs.set("month", String(params.month));
  if (params?.year) qs.set("year", String(params.year));
  const res = await api.get(`/api/budgets?${qs.toString()}`);
  return res.data.data as BudgetsResponse;
}

export async function upsertBudget(payload: {
  categoryId: string;
  amount: number;
  month: number;
  year: number;
}): Promise<void> {
  await api.post("/api/budgets", payload);
}

export async function deleteBudget(id: string): Promise<void> {
  await api.delete(`/api/budgets/${id}`);
}
