import type { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { CategoryModel } from "../models/Category";
import { CategoryCreateSchema, CategoryUpdateSchema } from "../validations/categories";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const items = await CategoryModel.find({ userId }).sort({ createdAt: -1 });
  return sendSuccess(res, { items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = CategoryCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const item = await CategoryModel.create({ userId, ...parsed.data });
  return sendSuccess(res, { item }, "دسته‌بندی ایجاد شد", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = CategoryUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const updated = await CategoryModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: parsed.data },
    { returnDocument: "after" }
  );

  if (!updated) throw new AppError(404, "دسته‌بندی یافت نشد");
  return sendSuccess(res, { item: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await CategoryModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "دسته‌بندی یافت نشد");

  return sendSuccess(res, { id }, "دسته‌بندی حذف شد");
});

