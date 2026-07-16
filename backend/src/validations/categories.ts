import { z } from "zod";

export const CategoryCreateSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  type: z.enum(["income", "expense"]),
  icon: z.string().min(1).max(60).trim(),
  color: z.string().min(3).max(30).trim(), // hex or tailwind token
});

export const CategoryUpdateSchema = CategoryCreateSchema.partial().extend({
  name: z.string().min(2).max(60).trim().optional(),
  type: z.enum(["income", "expense"]).optional(),
  icon: z.string().min(1).max(60).trim().optional(),
  color: z.string().min(3).max(30).trim().optional(),
});

