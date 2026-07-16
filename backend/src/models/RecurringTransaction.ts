import mongoose, { Schema, type InferSchemaType } from "mongoose";

const RecurringTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, enum: ["income", "expense"] },

    frequency: { type: String, required: true }, // e.g. daily/weekly/monthly/yearly (for future)
    nextPaymentDate: { type: String, required: true }, // Jalali YYYY/MM/DD
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true }
);

export type RecurringTransaction = InferSchemaType<typeof RecurringTransactionSchema>;
export type RecurringTransactionDocument = RecurringTransaction & { _id: mongoose.Types.ObjectId };

export const RecurringTransactionModel = mongoose.model<RecurringTransactionDocument>(
  "RecurringTransaction",
  RecurringTransactionSchema
);

