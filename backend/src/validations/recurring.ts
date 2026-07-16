import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

export const RecurringCreateSchema = z.object({
  title: z.string().min(2).max(120).trim(),
  amount: z.coerce.number().positive(),
  type: z.enum(["income", "expense"]),
  frequency: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
  nextPaymentDate: JalaliDateSchema,
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean().optional().default(true),
});

export const RecurringUpdateSchema = RecurringCreateSchema.partial();
