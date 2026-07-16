import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SavingsGoalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 1 },
    currentAmount: { type: Number, required: true, default: 0, min: 0 },
    deadline: { type: String, required: false, default: "" }, // Jalali YYYY/MM/DD optional
    color: { type: String, required: true, default: "#06b6d4" },
    icon: { type: String, required: true, default: "Target" },
    active: { type: Boolean, required: true, default: true, index: true },
    notes: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

export type SavingsGoal = InferSchemaType<typeof SavingsGoalSchema>;
export type SavingsGoalDocument = SavingsGoal & { _id: mongoose.Types.ObjectId };

export const SavingsGoalModel = mongoose.model<SavingsGoalDocument>("SavingsGoal", SavingsGoalSchema);
