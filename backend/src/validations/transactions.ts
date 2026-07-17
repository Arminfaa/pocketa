import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

const TagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(20)
  .optional()
  .transform((tags) => {
    if (!tags) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
      const key = t.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  });

const TransactionBaseFields = {
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive(),
  categoryId: z.string().min(1),
  accountId: z.string().min(1),
  title: z.string().min(2).max(120).trim(),
  description: z.string().max(500).optional().nullable(),
  date: JalaliDateSchema,
  tags: TagsSchema,
};

export const TransactionCreateSchema = z
  .object({
    ...TransactionBaseFields,
    /** ثبت هم‌زمان به‌عنوان بدهی یک‌باره در جریان دوره‌ای */
    registerAsDebt: z.boolean().optional().default(false),
    /** تاریخ پس‌دادن / سررسید بدهی (جلالی) */
    debtDueDate: JalaliDateSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.registerAsDebt && !data.debtDueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاریخ پس دادن بدهی را وارد کنید",
        path: ["debtDueDate"],
      });
    }
  });

export const TransactionUpdateSchema = z
  .object({
    ...TransactionBaseFields,
  })
  .partial()
  .extend({
    type: z.enum(["income", "expense"]).optional(),
    categoryId: z.string().min(1).optional(),
    accountId: z.string().min(1).optional(),
    needsReview: z.boolean().optional(),
    tags: TagsSchema,
  });

export const TransactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional().nullable(),
  type: z.enum(["income", "expense"]).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  tag: z.string().optional().nullable(),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  year: z.coerce.number().int().min(1300).max(2000).optional().nullable(),
  needsReview: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true";
    }),
  sortBy: z.string().optional().nullable(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const CategorySuggestSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["income", "expense"]).optional(),
});

export const SyncBalanceSchema = z.object({
  balanceAfter: z.coerce.number().optional(),
});

export const TransactionBulkDeleteSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "حداقل یک تراکنش انتخاب کنید")
    .max(200, "حداکثر ۲۰۰ تراکنش در هر درخواست"),
});
