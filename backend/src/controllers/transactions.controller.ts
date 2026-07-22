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
  TransferCreateSchema,
} from "../validations/transactions";
import { normalizeJalaliDate, toEnglishDigits } from "../utils/normalizeDigits";
import { normalizeTime } from "../utils/transactionTime";
import { tehranClockTime } from "../utils/tehranTime";
import { ensureDefaultAccount } from "../services/account.service";
import {
  ensureDebtExpenseCategory,
  ensureReceivableIncomeCategory,
} from "../services/debt-category.service";
import { settleRecurringWithExistingTransaction } from "../services/recurring-settle.service";
import { deleteTransactionsWithSideEffects } from "../services/transaction-delete.service";
import { ensureTransferCategories } from "../services/accounting.service";
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

/** Newest-first by default; use numeric dirs so Mongo never misreads "desc". */
function buildTransactionSort(
  sortBy: string | null | undefined,
  sortOrder: "asc" | "desc" | undefined
): Record<string, 1 | -1> {
  const dir: 1 | -1 = sortOrder === "asc" ? 1 : -1;
  const field = safeSort(sortBy);
  if (field === "date") {
    // آخرین تراکنش انجام‌شده = تاریخ جدیدتر، بعد ساعت، بعد زمان ثبت
    return { date: dir, time: dir, "bankMeta.time": dir, createdAt: dir };
  }
  return { [field]: dir, createdAt: -1 };
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
    source,
    sortBy,
    sortOrder,
  } = parsed.data;

  const filter: Record<string, unknown> = { userId };
  if (type) filter.type = type;
  if (categoryId) filter.categoryId = categoryId;
  if (accountId) filter.accountId = accountId;
  if (tag) filter.tags = tag;
  if (needsReview !== undefined) filter.needsReview = needsReview;
  if (source) filter.source = source;

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
    .sort(buildTransactionSort(sortBy, sortOrder))
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
    time,
    tags,
    registerAsDebt,
    debtDueDate,
    settleRecurringId,
    settleMode,
    remainderDueDate,
    clientId: rawClientId,
  } = parsed.data;

  const clientId =
    rawClientId && String(rawClientId).trim() ? String(rawClientId).trim() : undefined;

  if (clientId) {
    const existing = await TransactionModel.findOne({ userId, clientId });
    if (existing) {
      return sendSuccess(res, { item: existing, debt: null, settle: null }, "تراکنش از قبل ثبت شده", 200);
    }
  }

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
  const normalizedTime = normalizeTime(time);
  if (time && String(time).trim() && !normalizedTime) {
    throw new AppError(400, "ساعت باید به صورت HH:mm باشد");
  }

  let tx;
  try {
    tx = await TransactionModel.create({
      userId,
      accountId,
      type,
      amount,
      categoryId,
      title,
      description: description ?? "",
      date: normalizedDate,
      time: normalizedTime,
      tags: tags ?? [],
      source: "manual",
      needsReview: false,
      ...(clientId ? { clientId } : {}),
    });
  } catch (err) {
    if (clientId && "code" in (err as object) && (err as { code: number }).code === 11000) {
      const existing = await TransactionModel.findOne({ userId, clientId });
      if (existing) {
        return sendSuccess(
          res,
          { item: existing, debt: null, settle: null },
          "تراکنش از قبل ثبت شده",
          200
        );
      }
    }
    throw err;
  }

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
      remainderDueDate,
    });
    message = settle.message;
    tx.settledRecurringId = new mongoose.Types.ObjectId(settleRecurringId);
    tx.settleMode = settleMode;
    tx.settleSnapshot = settle.snapshot;
    if (settle.deferredDebt?._id) {
      tx.deferredDebtId = settle.deferredDebt._id;
    }
    await tx.save();
  }

  if (debt?._id) {
    tx.createdDebtId = debt._id;
    await tx.save();
  }

  return sendSuccess(res, { item: tx, debt, settle }, message, 201);
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransferCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { fromAccountId, toAccountId, amount, description, date } = parsed.data;
  const title =
    parsed.data.title?.trim() ||
    "انتقال بین حساب‌ها";

  const [fromAccount, toAccount, cats] = await Promise.all([
    BankAccountModel.findOne({ _id: fromAccountId, userId, isActive: true }),
    BankAccountModel.findOne({ _id: toAccountId, userId, isActive: true }),
    ensureTransferCategories(userId),
  ]);
  if (!fromAccount) throw new AppError(404, "حساب مبدأ یافت نشد");
  if (!toAccount) throw new AppError(404, "حساب مقصد یافت نشد");

  const normalizedDate = normalizeJalaliDate(date);
  const transferGroupId = new mongoose.Types.ObjectId();
  const outId = new mongoose.Types.ObjectId();
  const inId = new mongoose.Types.ObjectId();
  // Stamp clock time so transfers aren't buried under timed SMS rows (empty time sorts last).
  const time = tehranClockTime();

  // Dual-entry: − on source (expense) and + on destination (income).
  const outTx = await TransactionModel.create({
    _id: outId,
    userId,
    accountId: fromAccountId,
    type: "expense",
    amount,
    categoryId: cats.expense._id,
    title: `${title} → ${toAccount.name}`,
    description: description ?? `انتقال به ${toAccount.name}`,
    date: normalizedDate,
    time,
    tags: ["انتقال"],
    source: "transfer",
    needsReview: false,
    transferGroupId,
    linkedTransactionId: inId,
  });

  let inTx;
  try {
    inTx = await TransactionModel.create({
      _id: inId,
      userId,
      accountId: toAccountId,
      type: "income",
      amount,
      categoryId: cats.income._id,
      title: `${title} ← ${fromAccount.name}`,
      description: description ?? `انتقال از ${fromAccount.name}`,
      date: normalizedDate,
      time,
      tags: ["انتقال"],
      source: "transfer",
      needsReview: false,
      transferGroupId,
      linkedTransactionId: outId,
    });
  } catch (err) {
    await TransactionModel.deleteMany({
      _id: { $in: [outId, inId] },
      userId,
      transferGroupId,
    });
    throw err;
  }

  return sendSuccess(
    res,
    { item: outTx, linked: inTx, transferGroupId },
    "انتقال بین حساب‌ها ثبت شد",
    201
  );
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
  if (parsed.data.time !== undefined) {
    const normalizedTime = normalizeTime(parsed.data.time);
    if (parsed.data.time && String(parsed.data.time).trim() && !normalizedTime) {
      throw new AppError(400, "ساعت باید به صورت HH:mm باشد");
    }
    next.time = normalizedTime;
  }

  if (parsed.data.categoryId) {
    const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
    if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
    const nextType = (parsed.data.type ?? tx.type) as "income" | "expense";
    if (category.type !== nextType) {
      throw new AppError(400, "نوع دسته با نوع تراکنش همخوانی ندارد");
    }
    next.categoryId = parsed.data.categoryId;
  } else if (parsed.data.type && parsed.data.type !== tx.type) {
    const category = await CategoryModel.findById(tx.categoryId);
    if (category && category.type !== parsed.data.type) {
      throw new AppError(400, "نوع دسته با نوع تراکنش همخوانی ندارد");
    }
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

  const leavingReview =
    next.needsReview === false ||
    (parsed.data.needsReview === false);

  const bankMeta = (tx.bankMeta ?? {}) as {
    needsFee?: boolean;
    feeAmount?: number;
    transferAmount?: number;
    bankName?: string;
    accountHint?: string;
    balanceAfter?: number;
    time?: string;
    rawSnippet?: string;
  };

  if (parsed.data.feeAmount !== undefined) {
    if (tx.type !== "expense") {
      throw new AppError(400, "کارمزد فقط برای برداشت کارت‌به‌کارت معنا دارد");
    }
    const transferAmount = Number(
      bankMeta.transferAmount != null ? bankMeta.transferAmount : tx.amount
    );
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      throw new AppError(400, "مبلغ انتقال برای اعمال کارمزد نامعتبر است");
    }
    const feeAmount = Math.round(parsed.data.feeAmount);
    next.amount = transferAmount + feeAmount;
    next.bankMeta = {
      ...bankMeta,
      transferAmount,
      feeAmount,
      needsFee: false,
    };
  } else if (leavingReview && bankMeta.needsFee) {
    throw new AppError(400, "کارمزد تراکنش کارت‌به‌کارت را وارد کنید");
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
      remainderDueDate: parsed.data.remainderDueDate,
    });
    message = settle.message;
    updated.settledRecurringId = new mongoose.Types.ObjectId(parsed.data.settleRecurringId);
    updated.settleMode = parsed.data.settleMode;
    updated.settleSnapshot = settle.snapshot;
    if (settle.deferredDebt?._id) {
      updated.deferredDebtId = settle.deferredDebt._id;
    }
    await updated.save();
  }

  if (debt?._id) {
    updated.createdDebtId = debt._id;
    await updated.save();
  }

  return sendSuccess(res, { item: updated, debt, settle }, message);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const id = String(req.params.id ?? "");
  if (!id) throw new AppError(400, "شناسه تراکنش معتبر نیست");
  const result = await deleteTransactionsWithSideEffects(userId, [id]);
  if (result.deletedCount === 0) throw new AppError(404, "تراکنش یافت نشد");

  return sendSuccess(res, { id, deletedIds: result.deletedIds }, "تراکنش حذف شد");
});

export const bulkRemove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = TransactionBulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const result = await deleteTransactionsWithSideEffects(userId, parsed.data.ids);
  if (result.deletedCount === 0) {
    throw new AppError(400, "شناسه تراکنش معتبر نیست");
  }

  return sendSuccess(
    res,
    { deletedCount: result.deletedCount, ids: result.deletedIds },
    `${result.deletedCount} تراکنش حذف شد`
  );
});

/** Backfill helper for legacy docs without accountId — used internally if needed */
export const ensureAccountReady = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");
  const account = await ensureDefaultAccount(userId);
  return sendSuccess(res, { accountId: account._id });
});
