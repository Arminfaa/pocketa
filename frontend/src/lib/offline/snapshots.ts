import type { BankAccount } from "@/types/account";
import { offlineDb, type OfflineCategory } from "./db";

export async function saveAccountsSnapshot(
  userId: string,
  accounts: BankAccount[]
): Promise<void> {
  if (!userId) return;
  await offlineDb.snapshots.put({
    key: "accounts",
    userId,
    updatedAt: Date.now(),
    data: accounts,
  });
}

export async function saveCategoriesSnapshot(
  userId: string,
  categories: OfflineCategory[]
): Promise<void> {
  if (!userId) return;
  await offlineDb.snapshots.put({
    key: "categories",
    userId,
    updatedAt: Date.now(),
    data: categories,
  });
}

export async function getAccountsSnapshot(userId: string): Promise<BankAccount[]> {
  const row = await offlineDb.snapshots.get("accounts");
  if (!row || row.userId !== userId) return [];
  return (row.data as BankAccount[]) ?? [];
}

export async function getCategoriesSnapshot(userId: string): Promise<OfflineCategory[]> {
  const row = await offlineDb.snapshots.get("categories");
  if (!row || row.userId !== userId) return [];
  return (row.data as OfflineCategory[]) ?? [];
}
