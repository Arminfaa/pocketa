import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BankImportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    rawText: { type: String, required: true },
    jalaliYear: { type: Number, required: true },
    parsedCount: { type: Number, required: true, default: 0 },
    importedCount: { type: Number, required: true, default: 0 },
    skippedDuplicateCount: { type: Number, required: true, default: 0 },
    bankHint: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

export type BankImport = InferSchemaType<typeof BankImportSchema>;
export type BankImportDocument = BankImport & { _id: mongoose.Types.ObjectId };

export const BankImportModel = mongoose.model<BankImportDocument>("BankImport", BankImportSchema);
