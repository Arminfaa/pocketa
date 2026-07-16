import mongoose, { Schema, type InferSchemaType } from "mongoose";

const RecurringTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** حساب فقط موقع ثبت تراکنش لازم است؛ روی خود بدهی/قسط اختیاری است */
    accountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: false, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, enum: ["income", "expense"] },
    /** recurring = اقساط ماهانه؛ one_time = بدهی یک‌باره */
    kind: {
      type: String,
      required: true,
      enum: ["recurring", "one_time"],
      default: "recurring",
      index: true,
    },
    /** روز موعد در هر ماه (۱–۳۱) — فقط برای kind=recurring */
    dayOfMonth: { type: Number, min: 1, max: 31, required: false },
    /** forever = همیشگی؛ months = تا N ماه */
    endMode: {
      type: String,
      required: false,
      enum: ["forever", "months"],
      default: "forever",
    },
    /** تعداد کل ماه‌های تکرار وقتی endMode=months */
    endMonths: { type: Number, required: false, min: 1 },
    /** تعداد پرداخت‌های ثبت‌شده از این مورد */
    paymentsMade: { type: Number, required: true, default: 0, min: 0 },
    /** ساعت ارسال یادآور پوش (۰–۲۳، به وقت تهران) */
    reminderHour: { type: Number, required: true, min: 0, max: 23, default: 20 },
    /**
     * کلیدهای یادآور ارسال‌شده برای جلوگیری از تکرار
     * فرمت: `${nextPaymentDate}:${daysBefore}` مثلاً 1405/04/15:3
     */
    reminderSentKeys: { type: [String], required: true, default: [] },
    /** آخرین تاریخ پرداخت ثبت‌شده (جلالی) — برای چک‌لیست ماه */
    lastPaymentDate: { type: String, required: false },
    /** موعد بعدی / سررسید (جلالی YYYY/MM/DD) */
    nextPaymentDate: { type: String, required: true },
    active: { type: Boolean, required: true, default: true, index: true },
    notes: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

RecurringTransactionSchema.index({ userId: 1, active: 1, nextPaymentDate: 1 });

export type RecurringTransaction = InferSchemaType<typeof RecurringTransactionSchema>;
export type RecurringTransactionDocument = RecurringTransaction & { _id: mongoose.Types.ObjectId };

export const RecurringTransactionModel = mongoose.model<RecurringTransactionDocument>(
  "RecurringTransaction",
  RecurringTransactionSchema
);
