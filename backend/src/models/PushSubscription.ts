import mongoose, { Schema, type InferSchemaType } from "mongoose";

const PushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

PushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

export type PushSubscription = InferSchemaType<typeof PushSubscriptionSchema>;
export type PushSubscriptionDocument = PushSubscription & { _id: mongoose.Types.ObjectId };

export const PushSubscriptionModel = mongoose.model<PushSubscriptionDocument>(
  "PushSubscription",
  PushSubscriptionSchema
);
