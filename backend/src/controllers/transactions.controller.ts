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
  TransactionBulkDeleteSchema,
} from "../validations/transactions";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";
import { ensureDefaultAccount } from "../services/account.service";
import {
  ensureDebtExpenseCategory,
  ensureReceivableIncomeCategory,
} from "../services/debt-category.service";
import { settleRecurringWithExistingTransaction } from "../services/recurring-settle.service";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import mongoose from "mongoose";

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
    tag,
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
  if (tag) filter.tags = tag;
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

  const {
    type,
    amount,
    categoryId,
    accountId,
    title,
    description,
    date,
    tags,
    registerAsDebt,
    debtDueDate,
    settleRecurringId,
    settleMode,
  } = parsed.data;

  const [category, account] = await Promise.all([
    CategoryModel.findOne({ _id: categoryId, userId }),
    BankAccountModel.findOne({ _id: accountId, userId, isActive: true }),
  ]);

  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
  if (category.type !== type) {
    throw new AppError(400, "نوع دسته با نوع تراکنش همخوانی ندارد");
  }

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
    tags: tags ?? [],
    source: "manual",
    needsReview: false,
  });

  let debt = null;
  let settle = null;
  let message = "تراکنش ایجاد شد";

  if (registerAsDebt && debtDueDate) {
    const dueDate = normalizeJalaliDate(debtDueDate);
    if (type === "income") {
      // بدهی: پول آمده → سررسید بازپرداخت (هزینه)
      const debtCategory = await ensureDebtExpenseCategory(userId);
      debt = await RecurringTransactionModel.create({
        userId,
        title,
        amount,
        baseAmount: amount,
        type: "expense",
        kind: "one_time",
        categoryId: debtCategory._id,
        notes: `ثبت از تراکنش مثبت (${normalizedDate})`,
        active: true,
        paymentsMade: 0,
        reminderHour: 20,
        reminderSentKeys: [],
        nextPaymentDate: dueDate,
      });
      message = "تراکنش مثبت و بدهی یک‌باره ثبت شد";
    } else {
      // طلب: پول رفته → سررسید دریافت (درآمد)
      const creditCategory = await ensureReceivableIncomeCategory(userId);
      debt = await RecurringTransactionModel.create({
        userId,
        title,
        amount,
        baseAmount: amount,
        type: "income",
        kind: "one_time",
        categoryId: creditCategory._id,
        notes: `ثبت از تراکنش منفی (${normalizedDate})`,
        active: true,
        paymentsMade: 0,
        reminderHour: 20,
        reminderSentKeys: [],
        nextPaymentDate: dueDate,
      });
      message = "تراکنش منفی و طلب یک‌باره ثبت شد";
    }
  } else if (settleRecurringId && settleMode) {
    settle = await settleRecurringWithExistingTransaction({
      userId,
      recurringId: settleRecurringId,
      transactionType: type,
      paidAmount: amount,
      mode: settleMode,
    });
    message = settle.message;
  }

  return sendSuccess(res, { item: tx, debt, settle }, message, 201);
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

  if (parsed.data.tags !== undefined) {
    next.tags = parsed.data.tags;
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
  if (!updated) throw new AppError(404, "تراکنش یافت نشد");

  let debt = null;
  let settle = null;
  let message: string | undefined;

  if (parsed.data.registerAsDebt && parsed.data.debtDueDate) {
    const dueDate = normalizeJalaliDate(parsed.data.debtDueDate);
    const debtTitle = String(updated.title);
    const debtAmount = Number(updated.amount);
    const txType = updated.type as "income" | "expense";

    if (txType === "income") {
      const debtCategory = await ensureDebtExpenseCategory(userId);
      debt = await RecurringTransactionModel.create({
        userId,
        title: debtTitle,
        amount: debtAmount,
        baseAmount: debtAmount,
        type: "expense",
        kind: "one_time",
        categoryId: debtCategory._id,
        notes: `ثبت از تراکنش مثبت (${normalizeJalaliDate(updated.date)})`,
        active: true,
        paymentsMade: 0,
        reminderHour: 20,
        reminderSentKeys: [],
        nextPaymentDate: dueDate,
      });
      message = "تراکنش ذخیره و بدهی یک‌باره ثبت شد";
    } else {
      const creditCategory = await ensureReceivableIncomeCategory(userId);
      debt = await RecurringTransactionModel.create({
        userId,
        title: debtTitle,
        amount: debtAmount,
        baseAmount: debtAmount,
        type: "income",
        kind: "one_time",
        categoryId: creditCategory._id,
        notes: `ثبت از تراکنش منفی (${normalizeJalaliDate(updated.date)})`,
        active: true,
        paymentsMade: 0,
        reminderHour: 20,
        reminderSentKeys: [],
        nextPaymentDate: dueDate,
      });
      message = "تراکنش ذخیره و طلب یک‌باره ثبت شد";
    }
  } else if (parsed.data.settleRecurringId && parsed.data.settleMode) {
    settle = await settleRecurringWithExistingTransaction({
      userId,
      recurringId: parsed.data.settleRecurringId,
      transactionType: updated.type as "income" | "expense",
      paidAmount: Number(updated.amount),
      mode: parsed.data.settleMode,
    });
    message = settle.message;
  }

  return sendSuccess(res, { item: updated, debt, settle }, message);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await TransactionModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "تراکنش یافت نشد");

  return sendSuccess(res, { id }, "تراکنش حذف شد");
});

export const bulkRemove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionBulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const objectIds = parsed.data.ids
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (objectIds.length === 0) {
    throw new AppError(400, "شناسه تراکنش معتبر نیست");
  }

  const result = await TransactionModel.deleteMany({
    _id: { $in: objectIds },
    userId,
  });

  return sendSuccess(
    res,
    { deletedCount: result.deletedCount ?? 0, ids: parsed.data.ids },
    `${result.deletedCount ?? 0} تراکنش حذف شد`
  );
});

/** Backfill helper for legacy docs without accountId — used internally if needed */
export const ensureAccountReady = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");
  const account = await ensureDefaultAccount(userId);
  return sendSuccess(res, { accountId: account._id });
});
