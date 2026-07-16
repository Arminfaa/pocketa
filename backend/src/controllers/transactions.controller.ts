import type { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import {
  TransactionCreateSchema,
  TransactionUpdateSchema,
  TransactionQuerySchema,
} from "../validations/transactions";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";

function safeSort(sortBy: string | null | undefined) {
  const allowed: Record<string, string> = {
    date: "date",
    amount: "amount",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    title: "title",
  };
  return sortBy && allowed[sortBy] ? allowed[sortBy] : "date";
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionQuerySchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { page, limit, search, type, categoryId, month, year, sortBy, sortOrder } = parsed.data;

  const filter: Record<string, unknown> = { userId };
  if (type) filter.type = type;
  if (categoryId) filter.categoryId = categoryId;

  if (month && year) {
    const prefix = `${year}/${String(month).padStart(2, "0")}/`;
    filter.date = { $regex: `^${prefix}` };
  }

  if (search) {
    const q = toEnglishDigits(search);
    filter.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }

  const total = await TransactionModel.countDocuments(filter);

  const items = await TransactionModel.find(filter)
    .sort({ [safeSort(sortBy)]: sortOrder })
    .skip((page - 1) * limit)
    .limit(limit);

  return sendSuccess(res, { items, pagination: { page, limit, total } });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { type, amount, categoryId, title, description, date } = parsed.data;

  const category = await CategoryModel.findOne({ _id: categoryId, userId });
  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");

  const normalizedDate = normalizeJalaliDate(date);

  const tx = await TransactionModel.create({
    userId,
    type,
    amount,
    categoryId,
    title,
    description: description ?? "",
    date: normalizedDate,
  });

  return sendSuccess(res, { item: tx }, "تراکنش ایجاد شد", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const tx = await TransactionModel.findOne({ _id: id, userId });
  if (!tx) throw new AppError(404, "تراکنش یافت نشد");

  const next: Record<string, unknown> = {};

  if (parsed.data.type) next.type = parsed.data.type;
  if (parsed.data.amount !== undefined) next.amount = parsed.data.amount;
  if (parsed.data.title) next.title = parsed.data.title;
  if (parsed.data.description !== undefined) next.description = parsed.data.description ?? "";
  if (parsed.data.date) next.date = normalizeJalaliDate(parsed.data.date);

  if (parsed.data.categoryId) {
    const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
    if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
    next.categoryId = parsed.data.categoryId;
  }

  const updated = await TransactionModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: next },
    { new: true }
  );

  return sendSuccess(res, { item: updated });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await TransactionModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "تراکنش یافت نشد");

  return sendSuccess(res, { id }, "تراکنش حذف شد");
});

