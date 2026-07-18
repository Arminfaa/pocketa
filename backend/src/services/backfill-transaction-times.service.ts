import { TransactionModel } from "../models/Transaction";
import { resolveTransactionTime } from "../utils/transactionTime";

export type BackfillTimesResult = {
  scanned: number;
  updated: number;
  skipped: number;
};

/**
 * Fill missing top-level `time` from bankMeta.time or by parsing SMS/receipt text.
 * Idempotent — safe to run on every boot / repeatedly.
 */
export async function backfillTransactionTimes(limit = 5000): Promise<BackfillTimesResult> {
  const cursor = TransactionModel.find({
    $or: [{ time: { $exists: false } }, { time: null }, { time: "" }],
  })
    .select("_id time bankMeta description")
    .limit(limit)
    .cursor();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const resolved = resolveTransactionTime({
      time: doc.time,
      bankMetaTime: doc.bankMeta?.time,
      rawSnippet: doc.bankMeta?.rawSnippet,
      description: doc.description,
    });

    if (!resolved) {
      skipped += 1;
      continue;
    }

    doc.time = resolved;
    if (doc.bankMeta && !doc.bankMeta.time) {
      doc.bankMeta.time = resolved;
      doc.markModified("bankMeta");
    }
    await doc.save();
    updated += 1;
  }

  return { scanned, updated, skipped };
}
