import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

export const InvestmentCreateSchema = z
  .object({
    title: z.string().min(2).max(120).trim(),
    assetType: z.enum(["gold", "usd"]),
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
  })
  .superRefine((data, ctx) => {
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

export const InvestmentUpdateSchema = z.object({
  title: z.string().min(2).max(120).trim().optional(),
  quantity: z.coerce.number().positive().optional(),
  purchasePricePerUnit: z.coerce.number().positive().optional(),
  purchaseDate: JalaliDateSchema.optional(),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  profitEndDate: JalaliDateSchema.optional().nullable(),
});
