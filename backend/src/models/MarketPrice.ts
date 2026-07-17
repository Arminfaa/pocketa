import mongoose, { Schema, type InferSchemaType } from "mongoose";

export type MarketPriceKind = "gold" | "currency";

const MarketPriceSchema = new Schema(
  {
    kind: {
      type: String,
      enum: ["gold", "currency"],
      required: true,
      unique: true,
    },
    /** Gregorian date in Asia/Tehran: YYYY-MM-DD */
    fetchDate: { type: String, required: true, index: true },
    fetchedAt: { type: Date, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export type MarketPrice = InferSchemaType<typeof MarketPriceSchema>;
export type MarketPriceDocument = MarketPrice & { _id: mongoose.Types.ObjectId };

export const MarketPriceModel = mongoose.model<MarketPriceDocument>(
  "MarketPrice",
  MarketPriceSchema
);
