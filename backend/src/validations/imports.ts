import { z } from "zod";

export const BankSmsPreviewSchema = z.object({
  rawText: z.string().min(10, "متن پیامک‌ها خیلی کوتاه است"),
  accountId: z.string().min(1),
  jalaliYear: z.coerce.number().int().min(1390).max(1500).optional(),
});

export const BankSmsConfirmSchema = z.object({
  rawText: z.string().min(10),
  accountId: z.string().min(1),
  jalaliYear: z.coerce.number().int().min(1390).max(1500).optional(),
  /** Optional: only import selected hashes from preview */
  selectedHashes: z.array(z.string()).optional(),
});
