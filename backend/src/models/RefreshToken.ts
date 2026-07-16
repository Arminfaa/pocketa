import mongoose, { Schema, type InferSchemaType } from "mongoose";

const RefreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true }
);

export type RefreshToken = InferSchemaType<typeof RefreshTokenSchema>;
export type RefreshTokenDocument = RefreshToken & { _id: mongoose.Types.ObjectId };

export const RefreshTokenModel = mongoose.model<RefreshTokenDocument>(
  "RefreshToken",
  RefreshTokenSchema
);

