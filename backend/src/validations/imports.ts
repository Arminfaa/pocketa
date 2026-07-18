import { z } from "zod";

const ImportModeSchema = z.enum(["sms", "card_receipt"]).default("sms");

export const BankSmsPreviewSchema = z.object({
  rawText: z.string().min(10, "متن خیلی کوتاه است"),
  accountId: z.string().min(1),
  jalaliYear: z.coerce.number().int().min(1390).max(1500).optional(),
  /** sms = پیامک بانکی · card_receipt = رسید کارت‌به‌کارت */
  mode: ImportModeSchema.optional(),
});

export const BankSmsConfirmSchema = z.object({
  rawText: z.string().min(10),
  accountId: z.string().min(1),
  jalaliYear: z.coerce.number().int().min(1390).max(1500).optional(),
  mode: ImportModeSchema.optional(),
  /** Optional: only import selected hashes from preview */
  selectedHashes: z.array(z.string()).optional(),
});

