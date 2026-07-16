import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

export const TransactionCreateSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive(),
  categoryId: z.string().min(1),
  title: z.string().min(2).max(120).trim(),
  description: z.string().max(500).optional().nullable(),
  date: JalaliDateSchema,
});

export const TransactionUpdateSchema = TransactionCreateSchema.partial().extend({
  type: z.enum(["income", "expense"]).optional(),
  categoryId: z.string().min(1).optional(),
});

export const TransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().nullable(),
  type: z.enum(["income", "expense"]).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  year: z.coerce.number().int().min(1300).max(2000).optional().nullable(),
  sortBy: z.string().optional().nullable(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

