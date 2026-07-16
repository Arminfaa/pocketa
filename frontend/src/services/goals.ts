"use client";

import api from "@/services/api";

export type SavingsGoal = {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  remaining: number;
  deadline: string;
  color: string;
  icon: string;
  active: boolean;
  notes: string;
  percent: number;
  completed: boolean;
};

export async function fetchGoals(): Promise<{
  items: SavingsGoal[];
  summary: { totalTarget: number; totalSaved: number; completedCount: number };
}> {
  const res = await api.get("/api/goals");
  return res.data.data;
}

export async function createGoal(payload: {
  title: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  color?: string;
  notes?: string;
}): Promise<void> {
  await api.post("/api/goals", payload);
}

export async function updateGoal(
  id: string,
  payload: Partial<{
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    color: string;
    notes: string;
    active: boolean;
  }>
): Promise<void> {
  await api.put(`/api/goals/${id}`, payload);
}

export async function deleteGoal(id: string): Promise<void> {
  await api.delete(`/api/goals/${id}`);
}

export async function contributeGoal(id: string, amount: number): Promise<void> {
  await api.post(`/api/goals/${id}/contribute`, { amount });
}
