import mongoose, { Schema, type InferSchemaType } from "mongoose";

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    type: { type: String, required: true, enum: ["income", "expense"] },

    amount: { type: Number, required: true, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: false, default: "" },

    // Jalali date string: YYYY/MM/DD
    date: { type: String, required: true, index: true },
    /** Optional clock time HH:mm (from SMS import or manual picker) */
    time: { type: String, required: false, default: "" },

    source: {
      type: String,
      enum: ["manual", "bank_sms", "balance_adjustment", "transfer", "investment", "goal"],
      default: "manual",
    },
    needsReview: { type: Boolean, default: false, index: true },

    tags: { type: [String], default: [] },

    importHash: { type: String, required: false },
    /** Client-generated id for offline outbox idempotency */
    clientId: { type: String, required: false },
    bankMeta: {
      bankName: { type: String },
      accountHint: { type: String },
      balanceAfter: { type: Number },
      time: { type: String },
      rawSnippet: { type: String },
      /** کارمزد (تومان) — برای رسید کارت‌به‌کارت */
      feeAmount: { type: Number },
      /** مبلغ انتقال بدون کارمزد (تومان) */
      transferAmount: { type: Number },
      /** برداشت کارت‌به‌کارت: کارمزد باید در نام‌گذاری گرفته شود */
      needsFee: { type: Boolean },
    },

    /** Links the two legs of an inter-account transfer */
    transferGroupId: { type: Schema.Types.ObjectId, required: false, index: true },
    linkedTransactionId: { type: Schema.Types.ObjectId, ref: "Transaction", required: false },

    /** Settle / debt reverse metadata */
    settledRecurringId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
      required: false,
      index: true,
    },
    settleMode: { type: String, enum: ["full", "partial"], required: false },
    /** Snapshot of recurring state before settle — used to unwind on delete */
    settleSnapshot: { type: Schema.Types.Mixed, required: false },
    createdDebtId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
      required: false,
    },
    deferredDebtId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
      required: false,
    },

    investmentId: { type: Schema.Types.ObjectId, ref: "Investment", required: false },
    goalId: { type: Schema.Types.ObjectId, ref: "SavingsGoal", required: false },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, accountId: 1, date: -1, time: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1, time: -1 });
TransactionSchema.index({ userId: 1, tags: 1 });
TransactionSchema.index(
  { userId: 1, importHash: 1 },
  {
    unique: true,
    partialFilterExpression: { importHash: { $type: "string" } },
  }
);
TransactionSchema.index(
  { userId: 1, clientId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientId: { $type: "string" } },
  }
);

export type Transaction = InferSchemaType<typeof TransactionSchema>;
export type TransactionDocument = Transaction & { _id: mongoose.Types.ObjectId };

export const TransactionModel = mongoose.model<TransactionDocument>(
  "Transaction",
  TransactionSchema
);
