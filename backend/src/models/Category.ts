import mongoose, { Schema, type InferSchemaType } from "mongoose";

const CategorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ["income", "expense"] },
    icon: { type: String, required: true },
    color: { type: String, required: true },
  },
  { timestamps: true }
);

export type Category = InferSchemaType<typeof CategorySchema>;
export type CategoryDocument = Category & { _id: mongoose.Types.ObjectId };

export const CategoryModel = mongoose.model<CategoryDocument>("Category", CategorySchema);

