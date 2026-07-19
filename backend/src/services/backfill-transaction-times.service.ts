import { TransactionModel } from "../models/Transaction";
import { tehranClockTime } from "../utils/tehranTime";
import { resolveTransactionTime } from "../utils/transactionTime";

export type BackfillTimesResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

/**
 * Fill missing top-level `time` from bankMeta / SMS text, then createdAt (Tehran).
 * Empty `time` sorts below timed rows and can hide fresh transfers off page 1.
 * Idempotent — safe to run on every boot / repeatedly.
 */
export async function backfillTransactionTimes(limit = 5000): Promise<BackfillTimesResult> {
  const cursor = TransactionModel.find({
    $or: [{ time: { $exists: false } }, { time: null }, { time: "" }],
  })
    .select("_id time bankMeta description source createdAt")
    .limit(limit)
    .cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const fromText = resolveTransactionTime({
      time: doc.time,
      bankMetaTime: doc.bankMeta?.time,
      rawSnippet: doc.bankMeta?.rawSnippet,
      description: doc.description,
    });
    const fromCreatedAt = doc.createdAt
      ? tehranClockTime(new Date(doc.createdAt))
      : "";
    const resolved = fromText || fromCreatedAt;

    if (!resolved) {
      skipped += 1;
      continue;
    }

    doc.time = resolved;
    if (doc.bankMeta && !doc.bankMeta.time && fromText) {
      doc.bankMeta.time = fromText;
      doc.markModified("bankMeta");
    }
    await doc.save();
    updated += 1;
  }

  return { scanned, updated, skipped };
}
