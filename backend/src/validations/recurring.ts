import { z } from "zod";

const JalaliDigit = "[0-9۰-۹٠-٩]";
const JalaliDateSchema = z
  .string()
  .regex(new RegExp(`^${JalaliDigit}{4}\\/${JalaliDigit}{1,2}\\/${JalaliDigit}{1,2}$`));

const PaymentDaysSchema = z
  .array(z.coerce.number().int().min(1).max(31))
  .min(1)
  .max(6)
  .optional()
  .nullable();

const StageAmountsSchema = z
  .array(z.coerce.number().positive())
  .min(1)
  .max(6)
  .optional()
  .nullable();

const BaseFields = {
  title: z.string().min(2).max(120).trim(),
  amount: z.coerce.number().positive(),
  type: z.enum(["income", "expense"]),
  categoryId: z.string().min(1),
  notes: z.string().max(500).optional().nullable(),
  active: z.boolean().optional().default(true),
  /** ساعت یادآور پوش (۰–۲۳)، پیش‌فرض ۲۰ */
  reminderHour: z.coerce.number().int().min(0).max(23).optional().default(20),
  /** بدهی/طلب طلا یا دلار — برای قیمت‌گذاری مجدد هنگام تسویه */
  assetQuantity: z.coerce.number().positive().optional().nullable(),
  assetType: z.enum(["gold", "usd", "rial"]).optional().nullable(),
  goldKind: z.enum(["melted", "quarter_coin"]).optional().nullable(),
};

const RecurringKindSchema = z.object({
  ...BaseFields,
  kind: z.literal("recurring"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  paymentDays: PaymentDaysSchema,
  stageAmounts: StageAmountsSchema,
  endMode: z.enum(["forever", "months"]).default("forever"),
  endMonths: z.coerce.number().int().min(1).max(600).optional().nullable(),
});

const OneTimeKindSchema = z.object({
  ...BaseFields,
  kind: z.literal("one_time"),
  dueDate: JalaliDateSchema,
});

function refinePaymentStages(
  data: {
    dayOfMonth?: number;
    paymentDays?: number[] | null;
    stageAmounts?: number[] | null;
    amount: number;
  },
  ctx: z.RefinementCtx
) {
  const daysRaw = data.paymentDays?.filter((d) => d >= 1 && d <= 31) ?? [];
  const days =
    daysRaw.length > 0
      ? [...new Set(daysRaw)].sort((a, b) => a - b)
      : data.dayOfMonth != null
        ? [data.dayOfMonth]
        : [];

  if (days.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "روز موعد ماه را وارد کنید (۱ تا ۳۱)",
      path: ["dayOfMonth"],
    });
    return;
  }

  if (data.stageAmounts != null && data.stageAmounts.length > 0) {
    if (data.stageAmounts.length !== days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تعداد مبالغ مراحل باید با تعداد روزهای پرداخت یکی باشد",
        path: ["stageAmounts"],
      });
      return;
    }
    const sum = data.stageAmounts.reduce((s, n) => s + Math.round(n), 0);
    if (Math.abs(sum - Math.round(data.amount)) > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "جمع مبالغ مراحل باید برابر مبلغ ماهانه باشد",
        path: ["stageAmounts"],
      });
    }
  }
}

export const RecurringCreateSchema = z
  .discriminatedUnion("kind", [RecurringKindSchema, OneTimeKindSchema])
  .superRefine((data, ctx) => {
    if (data.kind === "recurring") {
      if (data.endMode === "months") {
        if (data.endMonths == null || data.endMonths < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "تعداد ماه‌ها را وارد کنید",
            path: ["endMonths"],
          });
        }
      }
      refinePaymentStages(data, ctx);
    }
    if (data.assetQuantity != null && data.assetQuantity > 0) {
      if (data.assetType !== "gold" && data.assetType !== "usd" && data.assetType !== "rial") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "نوع دارایی را مشخص کنید",
          path: ["assetType"],
        });
      }
      if (data.assetType === "gold" && !data.goldKind) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "نوع طلا را مشخص کنید",
          path: ["goldKind"],
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
    paymentDays: PaymentDaysSchema,
    stageAmounts: StageAmountsSchema,
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
    if (
      data.kind === "recurring" &&
      (data.paymentDays != null || data.stageAmounts != null || data.dayOfMonth != null) &&
      data.amount != null
    ) {
      refinePaymentStages(
        {
          dayOfMonth: data.dayOfMonth ?? undefined,
          paymentDays: data.paymentDays,
          stageAmounts: data.stageAmounts,
          amount: data.amount,
        },
        ctx
      );
    }
  });

const DeductionSchema = z.object({
  title: z.string().min(1).max(120).trim(),
  amount: z.coerce.number().positive(),
  categoryId: z.string().min(1).optional().nullable(),
});

/** حساب بانکی فقط موقع تبدیل به تراکنش (full/partial) الزامی است */
export const RecurringGenerateSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    mode: z.enum(["full", "partial", "postpone"]).default("full"),
    paidAmount: z.coerce.number().positive().optional(),
    /** مبلغ واقعی دریافتی/پرداختی هنگام تسویه کامل (مثلاً بعد از کارمزد یا اختلاف قیمت) */
    settledAmount: z.coerce.number().positive().optional(),
    /** کارمزد جدا از مبلغ سررسید (تومان) */
    feeAmount: z.coerce.number().min(0).optional(),
    /** کسورات موقع تسویه درآمد — از مبلغ ناخالص کم می‌شود */
    deductions: z.array(DeductionSchema).max(20).optional(),
    remainderHandling: z.enum(["next_month", "new_debt"]).optional(),
    remainderDueDate: JalaliDateSchema.optional(),
    postponeDueDate: JalaliDateSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "full" || data.mode === "partial") {
      if (!data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "حساب بانکی را انتخاب کنید",
          path: ["accountId"],
        });
      }
    }
    if (data.mode === "partial") {
      if (data.paidAmount == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "مبلغ پرداختی را وارد کنید",
          path: ["paidAmount"],
        });
      }
      if (!data.remainderHandling) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "نحوه تسویه مانده را انتخاب کنید",
          path: ["remainderHandling"],
        });
      }
      if (data.remainderHandling === "new_debt" && !data.remainderDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "تاریخ سررسید مانده را وارد کنید",
          path: ["remainderDueDate"],
        });
      }
      if (data.deductions && data.deductions.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "کسورات فقط در تسویه کامل قابل ثبت است",
          path: ["deductions"],
        });
      }
    }
  });
