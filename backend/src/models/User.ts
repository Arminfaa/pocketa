import mongoose, { Schema, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = User & { _id: mongoose.Types.ObjectId };

export const UserModel = mongoose.model<UserDocument>("User", UserSchema);
