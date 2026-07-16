import mongoose, { Schema, type InferSchemaType } from "mongoose";

const RecurringTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, enum: ["income", "expense"] },
    frequency: {
      type: String,
      required: true,
      enum: ["weekly", "monthly", "yearly"],
      default: "monthly",
    },
    nextPaymentDate: { type: String, required: true }, // Jalali YYYY/MM/DD
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
