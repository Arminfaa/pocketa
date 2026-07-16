import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

const BaseFields = {
  title: z.string().min(2).max(120).trim(),
  amount: z.coerce.number().positive(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean().optional().default(true),
  /** ساعت یادآور پوش (۰–۲۳)، پیش‌فرض ۲۰ */
  reminderHour: z.coerce.number().int().min(0).max(23).optional().default(20),
};

const RecurringKindSchema = z.object({
  ...BaseFields,
  kind: z.literal("recurring"),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  endMode: z.enum(["forever", "months"]).default("forever"),
  endMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
});

const OneTimeKindSchema = z.object({
  ...BaseFields,
  kind: z.literal("one_time"),
  dueDate: JalaliDateSchema,
});

export const RecurringCreateSchema = z
  .discriminatedUnion("kind", [RecurringKindSchema, OneTimeKindSchema])
  .superRefine((data, ctx) => {
    if (data.kind === "recurring" && data.endMode === "months") {
      if (data.endMonths == null || data.endMonths < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تعداد ماه‌ها را وارد کنید",
          path: ["endMonths"],
        });
      }
    }
  });

export const RecurringUpdateSchema = z
  .object({
    title: z.string().min(2).max(120).trim().optional(),
    amount: z.coerce.number().positive().optional(),
    type: z.enum(["income", "expense"]).optional(),
    kind: z.enum(["recurring", "one_time"]).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    endMode: z.enum(["forever", "months"]).optional().nullable(),
    endMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
    dueDate: JalaliDateSchema.optional().nullable(),
    nextPaymentDate: JalaliDateSchema.optional(),
    categoryId: z.string().min(1).optional(),
    notes: z.string().max(500).optional().nullable(),
    active: z.boolean().optional(),
    reminderHour: z.coerce.number().int().min(0).max(23).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "recurring" && data.endMode === "months") {
      if (data.endMonths == null || data.endMonths < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تعداد ماه‌ها را وارد کنید",
          path: ["endMonths"],
        });
      }
    }
    if (data.kind === "one_time" && !data.dueDate && !data.nextPaymentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تاریخ سررسید را وارد کنید",
        path: ["dueDate"],
      });
    }
  });

/** حساب بانکی فقط موقع تبدیل به تراکنش الزامی است */
export const RecurringGenerateSchema = z.object({
  accountId: z.string().min(1),
});
