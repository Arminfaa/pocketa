import mongoose, { Schema, type InferSchemaType } from "mongoose";

const InvestmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    /** طلا، دلار یا ریال (نقدی) */
    assetType: {
      type: String,
      required: true,
      enum: ["gold", "usd", "rial"],
      index: true,
    },
    /**
     * فقط وقتی assetType=gold:
     * melted = آب‌شده/پارسیان (گرم)
     * quarter_coin = ربع سکه (تعداد)
     */
    goldKind: {
      type: String,
      required: false,
      enum: ["melted", "quarter_coin"],
      default: "melted",
    },
    /** مقدار: گرم طلا / تعداد ربع سکه / دلار / تومان */
    quantity: { type: Number, required: true, min: 0 },
    /** قیمت خرید هر واحد (تومان) */
    purchasePricePerUnit: { type: Number, required: true, min: 0 },
    /** تاریخ خرید (جلالی) */
    purchaseDate: { type: String, required: true },
    hasProfit: { type: Boolean, required: true, default: false },
    /** fixed = مقدار ثابت از دارایی؛ percent = درصد از مقدار اصلی */
    profitMode: {
      type: String,
      required: false,
      enum: ["fixed", "percent"],
    },
    /** اگر percent: مثلاً ۲؛ اگر fixed: مثلاً ۱ گرم / دلار */
    profitValue: { type: Number, required: false, min: 0 },
    profitFrequency: {
      type: String,
      required: false,
      enum: ["daily", "monthly", "yearly"],
    },
    /** اولین / بعدی موعد سود (جلالی) */
    profitNextDate: { type: String, required: false, default: "" },
    /** پایان سرمایه‌گذاری / آخرین موعد سود (جلالی، اختیاری) */
    profitEndDate: { type: String, required: false, default: "" },
    /** لینک به درآمد دوره‌ای در بدهی/اقساط */
    recurringId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
      required: false,
      index: true,
    },
    /** مقدار سود هر دوره به واحد دارایی (گرم/دلار) — محاسبه‌شده */
    profitAssetQuantity: { type: Number, required: false, min: 0 },
    notes: { type: String, required: false, default: "" },
    active: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true }
);

InvestmentSchema.index({ userId: 1, active: 1, createdAt: -1 });

export type Investment = InferSchemaType<typeof InvestmentSchema>;
export type InvestmentDocument = Investment & { _id: mongoose.Types.ObjectId };

export const InvestmentModel = mongoose.model<InvestmentDocument>("Investment", InvestmentSchema);
