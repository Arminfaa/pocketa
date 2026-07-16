import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

export const GoalCreateSchema = z.object({
  title: z.string().min(2).max(120).trim(),
  targetAmount: z.coerce.number().positive(),
  currentAmount: z.coerce.number().min(0).optional().default(0),
  deadline: JalaliDateSchema.optional().nullable().or(z.literal("")),
  color: z.string().min(3).max(30).default("#06b6d4"),
  icon: z.string().min(1).max(60).default("Target"),
  notes: z.string().max(500).optional().nullable(),
});

export const GoalUpdateSchema = GoalCreateSchema.partial().extend({
  active: z.boolean().optional(),
});

export const GoalContributeSchema = z.object({
  amount: z.coerce.number().positive(),
});
