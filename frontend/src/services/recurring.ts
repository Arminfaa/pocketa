"use client";

import api from "@/services/api";

export type RecurringItem = {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  frequency: "weekly" | "monthly" | "yearly";
  nextPaymentDate: string;
  active: boolean;
  notes?: string;
  isDue: boolean;
  account: { _id: string; name: string; bankName?: string; color?: string } | string;
  category: { _id: string; name: string; color?: string; type?: string } | string;
};

export async function fetchRecurring(): Promise<{ items: RecurringItem[]; dueCount: number }> {
  const res = await api.get("/api/recurring");
  return res.data.data;
}

export async function createRecurring(payload: {
  title: string;
  amount: number;
  type: "income" | "expense";
  frequency: "weekly" | "monthly" | "yearly";
  nextPaymentDate: string;
  accountId: string;
  categoryId: string;
  notes?: string;
}): Promise<void> {
  await api.post("/api/recurring", payload);
}

export async function updateRecurring(
  id: string,
  payload: Partial<{
    title: string;
    amount: number;
    type: "income" | "expense";
    frequency: "weekly" | "monthly" | "yearly";
    nextPaymentDate: string;
    accountId: string;
    categoryId: string;
    notes: string;
    active: boolean;
  }>
): Promise<void> {
  await api.put(`/api/recurring/${id}`, payload);
}

export async function deleteRecurring(id: string): Promise<void> {
  await api.delete(`/api/recurring/${id}`);
}

export async function generateRecurring(id: string): Promise<void> {
  await api.post(`/api/recurring/${id}/generate`);
}
