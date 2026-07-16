import { z } from "zod";

export const BankAccountCreateSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  bankName: z.string().max(80).trim().optional().nullable(),
  color: z.string().min(3).max(30).trim().default("#06b6d4"),
  icon: z.string().min(1).max(60).trim().default("Landmark"),
  initialBalance: z.coerce.number().default(0),
});

export const BankAccountUpdateSchema = BankAccountCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});
