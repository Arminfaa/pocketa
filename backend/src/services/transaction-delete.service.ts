import mongoose from "mongoose";
import { TransactionModel } from "../models/Transaction";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import {
  unwindSettleFromSnapshot,
  type SettleSnapshot,
} from "./recurring-settle.service";

/**
 * Delete one or more transactions with accounting side-effects:
 * - delete both legs of a transfer
 * - reverse settle / remove unpaid deferred remainder
 * - remove debt/طلب created from the transaction if unpaid
 */
export async function deleteTransactionsWithSideEffects(
  userId: string,
  ids: string[]
): Promise<{ deletedCount: number; deletedIds: string[] }> {
  const objectIds = ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const txs = await TransactionModel.find({
    _id: { $in: objectIds },
    userId,
  });

  const toDelete = new Set<string>();
  const settleSnapshots: SettleSnapshot[] = [];
  const createdDebtIds: string[] = [];

  for (const tx of txs) {
    toDelete.add(String(tx._id));

    if (tx.transferGroupId) {
      const siblings = await TransactionModel.find({
        userId,
        transferGroupId: tx.transferGroupId,
      }).select("_id");
      for (const s of siblings) toDelete.add(String(s._id));
    }

    if (tx.linkedTransactionId) {
      toDelete.add(String(tx.linkedTransactionId));
    }

    const snap = tx.settleSnapshot as SettleSnapshot | undefined | null;
    if (snap && snap.recurringId) {
      settleSnapshots.push(snap);
    } else if (tx.settledRecurringId) {
      settleSnapshots.push({
        recurringId: String(tx.settledRecurringId),
        previousAmount: Number(tx.amount),
        previousBaseAmount: Number(tx.amount),
        previousNextPaymentDate: tx.date,
        previousActive: true,
        previousPaymentsMade: 0,
        previousLastPaymentDate: null,
        deferredDebtId: tx.deferredDebtId ? String(tx.deferredDebtId) : null,
        settleMode: (tx.settleMode as "full" | "partial") ?? "full",
      });
    }

    if (tx.createdDebtId) {
      createdDebtIds.push(String(tx.createdDebtId));
    }
  }

  for (const snap of settleSnapshots) {
    await unwindSettleFromSnapshot(userId, snap);
  }

  for (const debtId of createdDebtIds) {
    const debt = await RecurringTransactionModel.findOne({ _id: debtId, userId });
    if (debt && (debt.paymentsMade ?? 0) === 0) {
      await RecurringTransactionModel.deleteOne({ _id: debt._id });
    }
  }

  const deleteIds = [...toDelete].map((id) => new mongoose.Types.ObjectId(id));
  const result = await TransactionModel.deleteMany({
    _id: { $in: deleteIds },
    userId,
  });

  return {
    deletedCount: result.deletedCount ?? 0,
    deletedIds: [...toDelete],
  };
}
