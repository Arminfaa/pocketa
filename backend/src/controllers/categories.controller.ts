import type { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import { CategoryCreateSchema, CategoryUpdateSchema } from "../validations/categories";
import { CategorySuggestSchema } from "../validations/transactions";
import { suggestCategoryForTitle } from "../services/category-suggest.service";
import { NON_OPERATING_CATEGORY_NAMES } from "../services/accounting.service";

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
  const category = await CategoryModel.findOne({ _id: id, userId });
  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");

  if ((NON_OPERATING_CATEGORY_NAMES as readonly string[]).includes(category.name)) {
    throw new AppError(400, "دسته‌بندی سیستمی حسابداری قابل حذف نیست");
  }

  const inUse = await TransactionModel.countDocuments({ userId, categoryId: id });
  if (inUse > 0) {
    throw new AppError(
      400,
      `این دسته روی ${inUse.toLocaleString("en-US")} تراکنش استفاده شده و قابل حذف نیست`
    );
  }

  await CategoryModel.deleteOne({ _id: id, userId });
  return sendSuccess(res, { id }, "دسته‌بندی حذف شد");
});

export const suggest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = CategorySuggestSchema.safeParse({
    title: req.query.title ?? req.body?.title,
    type: req.query.type ?? req.body?.type,
  });
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const result = await suggestCategoryForTitle({
    userId,
    title: parsed.data.title,
    type: parsed.data.type,
  });

  return sendSuccess(res, result);
});

