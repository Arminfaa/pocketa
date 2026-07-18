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

const ObligationAndSettleFields = {
  /** ثبت هم‌زمان به‌عنوان بدهی (درآمد) یا طلب (هزینه) در جریان دوره‌ای */
  registerAsDebt: z.boolean().optional().default(false),
  /** تاریخ سررسید بدهی/طلب (جلالی) */
  debtDueDate: JalaliDateSchema.optional().nullable(),
  /** تسویه یک سررسید موجود با این تراکنش */
  settleRecurringId: z.string().min(1).optional().nullable(),
  settleMode: z.enum(["full", "partial"]).optional().nullable(),
  /** تاریخ تسویه مانده — الزامی وقتی settleMode=partial */
  remainderDueDate: JalaliDateSchema.optional().nullable(),
};

function refineObligationAndSettle(
  data: {
    registerAsDebt?: boolean;
    debtDueDate?: string | null;
    settleRecurringId?: string | null;
    settleMode?: "full" | "partial" | null;
    remainderDueDate?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.registerAsDebt && data.settleRecurringId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "نمی‌توان هم‌زمان بدهی/طلب جدید و تسویه سررسید موجود را انتخاب کرد",
      path: ["settleRecurringId"],
    });
  }
  if (data.registerAsDebt && !data.debtDueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "تاریخ سررسید را وارد کنید",
      path: ["debtDueDate"],
    });
  }
  if (data.settleRecurringId && !data.settleMode) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "نوع تسویه (کامل یا جزئی) را انتخاب کنید",
      path: ["settleMode"],
    });
  }
  if (data.settleRecurringId && data.settleMode === "partial" && !data.remainderDueDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "تاریخ تسویه مانده را وارد کنید",
      path: ["remainderDueDate"],
    });
  }
}

export const TransactionCreateSchema = z
  .object({
    ...TransactionBaseFields,
    ...ObligationAndSettleFields,
  })
  .superRefine(refineObligationAndSettle);

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
    ...ObligationAndSettleFields,
  })
  .superRefine(refineObligationAndSettle);

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

/** Set account book balance by posting an adjustment transaction for the delta. */
export const AdjustBalanceSchema = z.object({
  targetBalance: z.coerce.number(),
});

export const TransactionBulkDeleteSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "حداقل یک تراکنش انتخاب کنید")
    .max(200, "حداکثر ۲۰۰ تراکنش در هر درخواست"),
});
