import Dexie, { type EntityTable } from "dexie";
import type { BankAccount } from "@/types/account";
import type { TransactionInput } from "@/types/transaction";

export type OfflineCategory = {
  _id: string;
  name: string;
  type: "income" | "expense";
  color?: string;
  icon?: string;
};

export type OutboxStatus = "pending" | "syncing" | "failed";

export type OutboxItem = {
  clientId: string;
  userId: string;
  payload: TransactionInput;
  status: OutboxStatus;
  queuedAt: number;
  lastAttemptAt?: number;
  attempts: number;
  lastError?: string;
  /** Resolved account/category names for offline list display */
  accountName?: string;
  categoryName?: string;
};

export type SnapshotRow = {
  key: "accounts" | "categories";
  userId: string;
  updatedAt: number;
  data: BankAccount[] | OfflineCategory[];
};

class PocketaOfflineDb extends Dexie {
  outbox!: EntityTable<OutboxItem, "clientId">;
  snapshots!: EntityTable<SnapshotRow, "key">;

  constructor() {
    super("pocketa-offline");
    this.version(1).stores({
      outbox: "clientId, userId, status, queuedAt",
      snapshots: "key, userId, updatedAt",
    });
  }
}

export const offlineDb = new PocketaOfflineDb();

export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
