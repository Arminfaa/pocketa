"use client";

import api from "@/services/api";

export type DebtKind = "recurring" | "one_time";
export type DebtEndMode = "forever" | "months";

export type RecurringPaymentMode = "full" | "partial" | "postpone";
export type RemainderHandling = "next_month" | "new_debt";

export type SettlementDeduction = {
  title: string;
  amount: number;
  categoryId?: string | null;
};

export type RecurringItem = {
  id: string;
  title: string;
  /** مبلغ سررسید فعلی (مرحله جاری) */
  amount: number;
  /** مبلغ ماهانه کل */
  baseAmount: number;
  monthlyAmount?: number;
  type: "income" | "expense";
  kind: DebtKind;
  dayOfMonth: number | null;
  paymentDays?: number[];
  stageAmounts?: number[];
  currentStageIndex?: number;
  stageCount?: number;
  endMode: DebtEndMode | null;
  endMonths: number | null;
  paymentsMade: number;
  lastPaymentDate: string | null;
  reminderHour: number;
  nextPaymentDate: string;
  active: boolean;
  notes?: string;
  isDue: boolean;
  paidThisMonth: boolean;
  /** مبلغ اوکی‌شده همین ماه — برای ردیف تیک‌خورده چک‌لیست (پرداخت جزئی ≠ کل سررسید) */
  paidAmountThisMonth?: number | null;
  category: { _id: string; name: string; color?: string; type?: string } | string;
  investmentId?: string | null;
  assetQuantity?: number | null;
  assetType?: "gold" | "usd" | "rial" | null;
  goldKind?: "melted" | "quarter_coin" | null;
};

export type GenerateRecurringPayload = {
  accountId?: string;
  mode?: RecurringPaymentMode;
  paidAmount?: number;
  /** مبلغ واقعی دریافتی/پرداختی در تسویه کامل */
  settledAmount?: number;
  deductions?: SettlementDeduction[];
  remainderHandling?: RemainderHandling;
  remainderDueDate?: string;
  postponeDueDate?: string;
};

export type CreateDebtPayload =
  | {
      title: string;
      amount: number;
      type: "income" | "expense";
      kind: "recurring";
      dayOfMonth?: number;
      paymentDays?: number[];
      stageAmounts?: number[];
      endMode: DebtEndMode;
      endMonths?: number | null;
      categoryId: string;
      reminderHour: number;
      notes?: string;
      assetQuantity?: number | null;
      assetType?: "gold" | "usd" | "rial" | null;
      goldKind?: "melted" | "quarter_coin" | null;
    }
  | {
      title: string;
      amount: number;
      type: "income" | "expense";
      kind: "one_time";
      dueDate: string;
      categoryId: string;
      reminderHour: number;
      notes?: string;
      assetQuantity?: number | null;
      assetType?: "gold" | "usd" | "rial" | null;
      goldKind?: "melted" | "quarter_coin" | null;
    };

export async function fetchRecurring(): Promise<{
  items: RecurringItem[];
  monthChecklist: RecurringItem[];
  monthLabel: string;
  dueCount: number;
}> {
  const res = await api.get("/api/recurring");
  return res.data.data;
}

export async function createRecurring(payload: CreateDebtPayload): Promise<void> {
  await api.post("/api/recurring", payload);
}

export async function updateRecurring(
  id: string,
  payload: Partial<{
    title: string;
    amount: number;
    type: "income" | "expense";
    kind: DebtKind;
    dayOfMonth: number;
    paymentDays: number[];
    stageAmounts: number[];
    endMode: DebtEndMode;
    endMonths: number | null;
    dueDate: string;
    nextPaymentDate: string;
    categoryId: string;
    reminderHour: number;
    notes: string;
    active: boolean;
  }>
): Promise<void> {
  await api.put(`/api/recurring/${id}`, payload);
}

export async function deleteRecurring(id: string): Promise<void> {
  await api.delete(`/api/recurring/${id}`);
}

export async function generateRecurring(
  id: string,
  payload: GenerateRecurringPayload
): Promise<{ message?: string }> {
  const res = await api.post(`/api/recurring/${id}/generate`, payload);
  return { message: res.data?.message as string | undefined };
}
