import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BudgetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    month: { type: Number, required: true, min: 1, max: 12, index: true },
    year: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

BudgetSchema.index({ userId: 1, categoryId: 1, month: 1, year: 1 }, { unique: true });

export type Budget = InferSchemaType<typeof BudgetSchema>;
export type BudgetDocument = Budget & { _id: mongoose.Types.ObjectId };

export const BudgetModel = mongoose.model<BudgetDocument>("Budget", BudgetSchema);

