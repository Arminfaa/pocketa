import type { TransactionInput } from "@/types/transaction";
import { offlineDb, newClientId, type OutboxItem, type OutboxStatus } from "./db";

const OUTBOX_CHANGED = "pocketa-outbox-changed";

export function notifyOutboxChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OUTBOX_CHANGED));
}

export function subscribeOutboxChanged(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(OUTBOX_CHANGED, listener);
  return () => window.removeEventListener(OUTBOX_CHANGED, listener);
}

export type EnqueueInput = {
  userId: string;
  payload: TransactionInput;
  accountName?: string;
  categoryName?: string;
  clientId?: string;
};

export async function enqueueTransaction(input: EnqueueInput): Promise<OutboxItem> {
  const item: OutboxItem = {
    clientId: input.clientId ?? newClientId(),
    userId: input.userId,
    payload: input.payload,
    status: "pending",
    queuedAt: Date.now(),
    attempts: 0,
    accountName: input.accountName,
    categoryName: input.categoryName,
  };
  await offlineDb.outbox.put(item);
  notifyOutboxChanged();
  return item;
}

export async function listOutboxForUser(userId: string): Promise<OutboxItem[]> {
  if (!userId) return [];
  const rows = await offlineDb.outbox.where("userId").equals(userId).toArray();
  return rows.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function listPendingOutbox(userId: string): Promise<OutboxItem[]> {
  const rows = await listOutboxForUser(userId);
  return rows.filter((r) => r.status === "pending" || r.status === "failed");
}

export async function countUnsyncedOutbox(userId: string): Promise<number> {
  const rows = await listOutboxForUser(userId);
  return rows.filter(
    (r) => r.status === "pending" || r.status === "syncing" || r.status === "failed"
  ).length;
}

export async function updateOutboxStatus(
  clientId: string,
  patch: Partial<Pick<OutboxItem, "status" | "lastAttemptAt" | "attempts" | "lastError">>
): Promise<void> {
  const existing = await offlineDb.outbox.get(clientId);
  if (!existing) return;
  await offlineDb.outbox.put({ ...existing, ...patch });
  notifyOutboxChanged();
}

export async function removeOutboxItem(clientId: string): Promise<void> {
  await offlineDb.outbox.delete(clientId);
  notifyOutboxChanged();
}

export async function resetStuckSyncing(userId: string): Promise<void> {
  const rows = await offlineDb.outbox.where("userId").equals(userId).toArray();
  for (const row of rows) {
    if (row.status === "syncing") {
      await offlineDb.outbox.put({ ...row, status: "pending" as OutboxStatus });
    }
  }
  notifyOutboxChanged();
}

export async function clearOutboxForUser(userId: string): Promise<void> {
  await offlineDb.outbox.where("userId").equals(userId).delete();
  notifyOutboxChanged();
}
