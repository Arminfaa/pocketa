import { z } from "zod";

export const BudgetCreateSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.coerce.number().positive(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1300).max(2000),
});

export const BudgetUpdateSchema = BudgetCreateSchema.partial().extend({
  amount: z.coerce.number().positive().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(1300).max(2000).optional(),
  categoryId: z.string().min(1).optional(),
});

export const BudgetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  year: z.coerce.number().int().min(1300).max(2000).optional().nullable(),
});

