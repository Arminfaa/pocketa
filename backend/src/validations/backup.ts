import { z } from "zod";

const objectIdString = z.string().min(1);

const docBase = z
  .object({
    _id: objectIdString,
  })
  .passthrough();

export const BackupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().min(1),
  user: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  accounts: z.array(docBase),
  categories: z.array(docBase),
  goals: z.array(docBase),
  investments: z.array(docBase),
  recurring: z.array(docBase),
  transactions: z.array(docBase),
  budgets: z.array(docBase),
  bankImports: z.array(docBase).default([]),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;
