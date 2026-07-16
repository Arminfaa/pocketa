import mongoose, { Schema, type InferSchemaType } from "mongoose";

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, enum: ["income", "expense"] },

    amount: { type: Number, required: true, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, default: "" },

    // Jalali date string: YYYY/MM/DD
    date: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, type: 1, date: -1 });

export type Transaction = InferSchemaType<typeof TransactionSchema>;
export type TransactionDocument = Transaction & { _id: mongoose.Types.ObjectId };

export const TransactionModel = mongoose.model<TransactionDocument>(
  "Transaction",
  TransactionSchema
);

