import type { TransactionInput } from "@/types/transaction";
import { createTransaction } from "@/services/transactions";
import { offlineDb } from "./db";
import { enqueueTransaction } from "./outbox";
import { syncOutbox } from "./sync";

export type CaptureResult =
  | { mode: "synced"; clientId?: string }
  | { mode: "queued"; clientId: string };

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; response?: unknown };
  if (e.code === "ERR_NETWORK" || e.message === "Network Error") return true;
  if (!e.response && typeof navigator !== "undefined" && !navigator.onLine) return true;
  return false;
}

/**
 * Prefer immediate API when online; on network failure or offline, enqueue to outbox.
 * Complex fields (debt/settle) must only be used while online — caller should gate them.
 */
export async function captureTransaction(opts: {
  userId: string;
  payload: TransactionInput;
  accountName?: string;
  categoryName?: string;
  /** Force queue even when online (quick-capture UX). Still tries sync right away. */
  preferQueue?: boolean;
}): Promise<CaptureResult> {
  const { userId, payload, accountName, categoryName, preferQueue } = opts;
  const online = typeof navigator === "undefined" || navigator.onLine;

  if (!online || preferQueue) {
    const item = await enqueueTransaction({
      userId,
      payload,
      accountName,
      categoryName,
    });
    if (online) {
      await syncOutbox(userId);
      const stillThere = await offlineDb.outbox.get(item.clientId);
      if (!stillThere) return { mode: "synced", clientId: item.clientId };
    }
    return { mode: "queued", clientId: item.clientId };
  }

  try {
    await createTransaction(payload);
    return { mode: "synced" };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const item = await enqueueTransaction({
      userId,
      payload,
      accountName,
      categoryName,
    });
    return { mode: "queued", clientId: item.clientId };
  }
}
