import type { Transaction } from "@/types/transaction";
import type { OutboxItem } from "./db";

/** Map an outbox row to a Transaction-shaped object for list UI. */
export function outboxToPendingTransaction(item: OutboxItem): Transaction & {
  syncStatus: OutboxItem["status"];
  syncError?: string;
  clientId: string;
} {
  const { payload } = item;
  return {
    _id: `pending:${item.clientId}`,
    type: payload.type,
    amount: payload.amount,
    title: payload.title,
    description: payload.description ?? undefined,
    date: payload.date,
    time: payload.time ?? undefined,
    source: "manual",
    needsReview: false,
    tags: payload.tags,
    categoryId: {
      _id: payload.categoryId,
      name: item.categoryName ?? "—",
      type: payload.type,
    },
    accountId: {
      _id: payload.accountId,
      name: item.accountName ?? "—",
    },
    createdAt: new Date(item.queuedAt).toISOString(),
    syncStatus: item.status,
    syncError: item.lastError,
    clientId: item.clientId,
  };
}

export function isPendingTransactionId(id: string): boolean {
  return id.startsWith("pending:");
}
