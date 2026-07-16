import type { Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { asyncHandler } from "../middleware/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { TransactionModel } from "../models/Transaction";
import { CategoryModel } from "../models/Category";
import { BankAccountModel } from "../models/BankAccount";
import {
  TransactionCreateSchema,
  TransactionUpdateSchema,
  TransactionQuerySchema,
} from "../validations/transactions";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";
import { ensureDefaultAccount } from "../services/account.service";

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

  const {
    page,
    limit,
    search,
    type,
    categoryId,
    accountId,
    month,
    year,
    needsReview,
    sortBy,
    sortOrder,
  } = parsed.data;

  const filter: Record<string, unknown> = { userId };
  if (type) filter.type = type;
  if (categoryId) filter.categoryId = categoryId;
  if (accountId) filter.accountId = accountId;
  if (needsReview !== undefined) filter.needsReview = needsReview;

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
    .limit(limit)
    .populate({ path: "accountId", select: "name bankName color icon" })
    .populate({ path: "categoryId", select: "name type icon color" });

  return sendSuccess(res, { items, pagination: { page, limit, total } });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { type, amount, categoryId, accountId, title, description, date } = parsed.data;

  const [category, account] = await Promise.all([
    CategoryModel.findOne({ _id: categoryId, userId }),
    BankAccountModel.findOne({ _id: accountId, userId, isActive: true }),
  ]);

  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const normalizedDate = normalizeJalaliDate(date);

  const tx = await TransactionModel.create({
    userId,
    accountId,
    type,
    amount,
    categoryId,
    title,
    description: description ?? "",
    date: normalizedDate,
    source: "manual",
    needsReview: false,
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

  if (parsed.data.accountId) {
    const account = await BankAccountModel.findOne({
      _id: parsed.data.accountId,
      userId,
      isActive: true,
    });
    if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
    next.accountId = parsed.data.accountId;
  }

  if (parsed.data.needsReview !== undefined) {
    next.needsReview = parsed.data.needsReview;
  }

  // If user sets a real title while reviewing, clear needsReview unless explicitly kept.
  if (parsed.data.title && parsed.data.needsReview === undefined) {
    next.needsReview = false;
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

/** Backfill helper for legacy docs without accountId — used internally if needed */
export const ensureAccountReady = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");
  const account = await ensureDefaultAccount(userId);
  return sendSuccess(res, { accountId: account._id });
});
