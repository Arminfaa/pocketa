import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BankAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    bankName: { type: String, required: false, default: "", trim: true },
    color: { type: String, required: true, default: "#06b6d4" },
    icon: { type: String, required: true, default: "Landmark" },
    initialBalance: { type: Number, required: true, default: 0 },
    isActive: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true }
);

BankAccountSchema.index({ userId: 1, name: 1 });

export type BankAccount = InferSchemaType<typeof BankAccountSchema>;
export type BankAccountDocument = BankAccount & { _id: mongoose.Types.ObjectId };

export const BankAccountModel = mongoose.model<BankAccountDocument>(
  "BankAccount",
  BankAccountSchema
);
