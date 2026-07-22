import { createTransaction } from "@/services/transactions";
import {
  listPendingOutbox,
  removeOutboxItem,
  resetStuckSyncing,
  updateOutboxStatus,
} from "./outbox";

let syncing = false;

export type SyncResult = {
  synced: number;
  failed: number;
};

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; response?: unknown };
  if (e.code === "ERR_NETWORK" || e.message === "Network Error") return true;
  if (!e.response && typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

function errorMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  if (msg) return msg;
  if (isNetworkError(err)) return "ارتباط با سرور برقرار نشد";
  return "همگام‌سازی ناموفق بود";
}

/**
 * Push pending/failed outbox items to the API (one at a time, FIFO).
 * Safe to call repeatedly; concurrent runs are coalesced.
 */
export async function syncOutbox(userId: string): Promise<SyncResult> {
  if (!userId) return { synced: 0, failed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  if (syncing) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;

  try {
    await resetStuckSyncing(userId);
    const queue = await listPendingOutbox(userId);

    for (const item of queue) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;

      await updateOutboxStatus(item.clientId, {
        status: "syncing",
        lastAttemptAt: Date.now(),
        attempts: item.attempts + 1,
        lastError: undefined,
      });

      try {
        await createTransaction({
          ...item.payload,
          clientId: item.clientId,
        });
        await removeOutboxItem(item.clientId);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err)) {
          await updateOutboxStatus(item.clientId, {
            status: "pending",
            lastError: errorMessage(err),
          });
          break;
        }
        await updateOutboxStatus(item.clientId, {
          status: "failed",
          lastError: errorMessage(err),
        });
        failed += 1;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}

export function isSyncInFlight(): boolean {
  return syncing;
}
