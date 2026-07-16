"use client";

import api from "@/services/api";
import type { Transaction, TransactionInput, TransactionsListResponse } from "@/types/transaction";

export type TransactionListParams = {
  page?: number;
  limit?: number;
  search?: string;
  type?: "income" | "expense" | "";
  categoryId?: string;
  accountId?: string | null;
  needsReview?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export async function fetchTransactions(
  params: TransactionListParams = {}
): Promise<TransactionsListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 20));
  if (params.search) qs.set("search", params.search);
  if (params.type) qs.set("type", params.type);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.accountId) qs.set("accountId", params.accountId);
  if (params.needsReview !== undefined) qs.set("needsReview", String(params.needsReview));
  if (params.sortBy) qs.set("sortBy", params.sortBy);
  if (params.sortOrder) qs.set("sortOrder", params.sortOrder);

  const res = await api.get(`/api/transactions?${qs.toString()}`);
  return res.data.data as TransactionsListResponse;
}

export async function createTransaction(payload: TransactionInput): Promise<Transaction> {
  const res = await api.post("/api/transactions", payload);
  return res.data.data.item as Transaction;
}

export async function updateTransaction(
  id: string,
  payload: Partial<TransactionInput>
): Promise<Transaction> {
  const res = await api.put(`/api/transactions/${id}`, payload);
  return res.data.data.item as Transaction;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/transactions/${id}`);
}

export async function fetchCategories(): Promise<
  Array<{ _id: string; name: string; type: "income" | "expense"; color?: string }>
> {
  const res = await api.get("/api/categories");
  return res.data?.data?.items ?? [];
}
