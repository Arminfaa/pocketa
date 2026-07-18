import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

export const InvestmentCreateSchema = z
  .object({
    title: z.string().min(2).max(120).trim(),
    assetType: z.enum(["gold", "usd", "rial"]),
    /** فقط برای طلا — پیش‌فرض آب‌شده/پارسیان */
    goldKind: z.enum(["melted", "quarter_coin"]).optional().nullable(),
    quantity: z.coerce.number().positive(),
    purchasePricePerUnit: z.coerce.number().positive(),
    purchaseDate: JalaliDateSchema,
    hasProfit: z.boolean().default(false),
    profitMode: z.enum(["fixed", "percent"]).optional().nullable(),
    profitValue: z.coerce.number().positive().optional().nullable(),
    profitFrequency: z.enum(["daily", "monthly", "yearly"]).optional().nullable(),
    profitNextDate: JalaliDateSchema.optional().nullable(),
    profitEndDate: JalaliDateSchema.optional().nullable(),
    notes: z.string().max(500).optional().nullable(),
    /** Bank account to debit for the purchase (cash outlay) */
    accountId: z.string().min(1, "حساب بانکی خرید را انتخاب کنید"),
  })
  .superRefine((data, ctx) => {
    if (data.assetType === "gold" && !data.goldKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "نوع طلا را انتخاب کنید",
        path: ["goldKind"],
      });
    }
    if (
      data.assetType === "gold" &&
      data.goldKind === "quarter_coin" &&
      (!Number.isInteger(data.quantity) || data.quantity < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تعداد ربع سکه باید عدد صحیح باشد",
        path: ["quantity"],
      });
    }
    if (!data.hasProfit) return;

    if (!data.profitMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "نوع سود را مشخص کنید",
        path: ["profitMode"],
      });
    }
    if (data.profitValue == null || data.profitValue <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقدار سود را وارد کنید",
        path: ["profitValue"],
      });
    }
    if (!data.profitFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "دوره سود را مشخص کنید",
        path: ["profitFrequency"],
      });
    }
    if (!data.profitNextDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاریخ پرداخت سود را وارد کنید",
        path: ["profitNextDate"],
      });
    }
    if (data.profitMode === "percent" && data.profitValue != null && data.profitValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "درصد سود نباید بیشتر از ۱۰۰ باشد",
        path: ["profitValue"],
      });
    }
  });

export const InvestmentUpdateSchema = z
  .object({
    title: z.string().min(2).max(120).trim().optional(),
    quantity: z.coerce.number().positive().optional(),
    purchasePricePerUnit: z.coerce.number().positive().optional(),
    purchaseDate: JalaliDateSchema.optional(),
    notes: z.string().max(500).optional().nullable(),
    active: z.boolean().optional(),
    profitEndDate: JalaliDateSchema.optional().nullable(),
    profitNextDate: JalaliDateSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (
      data.quantity != null &&
      (!Number.isFinite(data.quantity) || data.quantity <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقدار معتبر نیست",
        path: ["quantity"],
      });
    }
  });

export const InvestmentSellSchema = z
  .object({
    quantity: z.coerce.number().positive(),
    /** تومان per unit (for rial assets use 1) */
    salePricePerUnit: z.coerce.number().positive(),
    saleDate: JalaliDateSchema,
    accountId: z.string().min(1, "حساب واریز فروش را انتخاب کنید"),
    notes: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "مقدار فروش معتبر نیست",
        path: ["quantity"],
      });
    }
  });
