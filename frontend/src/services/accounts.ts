"use client";

import api from "@/services/api";
import type { BankAccount } from "@/types/account";

type AccountsResponse = { items: BankAccount[] };
type AccountResponse = { item: BankAccount };

export type BalanceAdjustment = {
  type: "income" | "expense";
  amount: number;
  id: string;
};

function normalize(item: Record<string, unknown>): BankAccount {
  return {
    id: String(item.id ?? item._id),
    name: String(item.name ?? ""),
    bankName: String(item.bankName ?? ""),
    color: String(item.color ?? "#06b6d4"),
    icon: String(item.icon ?? "Landmark"),
    initialBalance: Number(item.initialBalance ?? 0),
    isActive: Boolean(item.isActive ?? true),
    balance: Number(item.balance ?? 0),
    transactionCount:
      item.transactionCount !== undefined ? Number(item.transactionCount) : undefined,
  };
}

export async function fetchAccounts(): Promise<BankAccount[]> {
  const res = await api.get("/api/accounts");
  const data = res.data?.data as AccountsResponse;
  return (data?.items ?? []).map((item) => normalize(item as unknown as Record<string, unknown>));
}

export async function createAccount(payload: {
  name: string;
  bankName?: string;
  color?: string;
  icon?: string;
  initialBalance?: number;
}): Promise<BankAccount> {
  const res = await api.post("/api/accounts", payload);
  const data = res.data?.data as AccountResponse;
  return normalize(data.item as unknown as Record<string, unknown>);
}

export async function updateAccount(
  id: string,
  payload: Partial<{
    name: string;
    bankName: string;
    color: string;
    icon: string;
    isActive: boolean;
  }>
): Promise<BankAccount> {
  const res = await api.put(`/api/accounts/${id}`, payload);
  const data = res.data?.data as AccountResponse;
  return normalize(data.item as unknown as Record<string, unknown>);
}

export async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/api/accounts/${id}`);
}

/** Set book balance by creating an adjustment income/expense for the delta. */
export async function adjustAccountBalance(
  id: string,
  targetBalance: number
): Promise<
  BankAccount & {
    previousBalance?: number;
    adjustment?: BalanceAdjustment | null;
  }
> {
  const res = await api.post(`/api/accounts/${id}/adjust-balance`, { targetBalance });
  const data = res.data?.data as {
    item: Record<string, unknown> & {
      previousBalance?: number;
      adjustment?: BalanceAdjustment | null;
    };
  };
  return {
    ...normalize(data.item as unknown as Record<string, unknown>),
    previousBalance:
      data.item.previousBalance !== undefined ? Number(data.item.previousBalance) : undefined,
    adjustment: data.item.adjustment ?? null,
  };
}
