import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { BankAccountModel } from "../models/BankAccount";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import { RecurringCreateSchema, RecurringUpdateSchema } from "../validations/recurring";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import {
  advanceJalaliDate,
  isDueOnOrBefore,
  todayJalali,
  type Frequency,
} from "../utils/jalaliDate";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const activeOnly = String(req.query.activeOnly ?? "true") !== "false";
  const filter: Record<string, unknown> = { userId };
  if (activeOnly) filter.active = true;

  const items = await RecurringTransactionModel.find(filter)
    .sort({ nextPaymentDate: 1 })
    .populate({ path: "accountId", select: "name bankName color" })
    .populate({ path: "categoryId", select: "name color type icon" });

  const today = todayJalali();
  const mapped = items.map((item) => ({
    id: item._id,
    title: item.title,
    amount: item.amount,
    type: item.type,
    frequency: item.frequency,
    nextPaymentDate: item.nextPaymentDate,
    active: item.active,
    notes: item.notes ?? "",
    account: item.accountId,
    category: item.categoryId,
    isDue: item.active && isDueOnOrBefore(item.nextPaymentDate, today),
    createdAt: (item as { createdAt?: Date }).createdAt,
  }));

  return sendSuccess(res, {
    items: mapped,
    dueCount: mapped.filter((i) => i.isDue).length,
    today,
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = RecurringCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const [account, category] = await Promise.all([
    BankAccountModel.findOne({ _id: parsed.data.accountId, userId, isActive: true }),
    CategoryModel.findOne({ _id: parsed.data.categoryId, userId }),
  ]);
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
  if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  if (category.type !== parsed.data.type) {
    throw new AppError(400, "نوع دسته با نوع تراکنش همخوانی ندارد");
  }

  const item = await RecurringTransactionModel.create({
    userId,
    title: parsed.data.title,
    amount: parsed.data.amount,
    type: parsed.data.type,
    frequency: parsed.data.frequency,
    nextPaymentDate: normalizeJalaliDate(parsed.data.nextPaymentDate),
    accountId: parsed.data.accountId,
    categoryId: parsed.data.categoryId,
    notes: parsed.data.notes ?? "",
    active: parsed.data.active ?? true,
  });

  return sendSuccess(res, { item }, "پرداخت تکرارشونده ایجاد شد", 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = RecurringUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const existing = await RecurringTransactionModel.findOne({ _id: id, userId });
  if (!existing) throw new AppError(404, "مورد یافت نشد");

  if (parsed.data.accountId) {
    const account = await BankAccountModel.findOne({
      _id: parsed.data.accountId,
      userId,
      isActive: true,
    });
    if (!account) throw new AppError(404, "حساب بانکی یافت نشد");
  }
  if (parsed.data.categoryId) {
    const category = await CategoryModel.findOne({ _id: parsed.data.categoryId, userId });
    if (!category) throw new AppError(404, "دسته‌بندی یافت نشد");
  }

  const next: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.nextPaymentDate) {
    next.nextPaymentDate = normalizeJalaliDate(parsed.data.nextPaymentDate);
  }
  if (parsed.data.notes !== undefined) next.notes = parsed.data.notes ?? "";

  const item = await RecurringTransactionModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: next },
    { returnDocument: "after" }
  );

  return sendSuccess(res, { item });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await RecurringTransactionModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "مورد یافت نشد");

  return sendSuccess(res, { id }, "حذف شد");
});

/** Create a real transaction from a due recurring item and advance next date. */
export const generate = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const recurring = await RecurringTransactionModel.findOne({ _id: id, userId, active: true });
  if (!recurring) throw new AppError(404, "پرداخت تکرارشونده فعال یافت نشد");

  const tx = await TransactionModel.create({
    userId,
    accountId: recurring.accountId,
    categoryId: recurring.categoryId,
    type: recurring.type,
    amount: recurring.amount,
    title: recurring.title,
    description: recurring.notes || `تولید خودکار از تکرارشونده (${recurring.frequency})`,
    date: normalizeJalaliDate(recurring.nextPaymentDate),
    source: "manual",
    needsReview: false,
  });

  recurring.nextPaymentDate = advanceJalaliDate(
    recurring.nextPaymentDate,
    recurring.frequency as Frequency
  );
  await recurring.save();

  return sendSuccess(
    res,
    {
      transaction: tx,
      nextPaymentDate: recurring.nextPaymentDate,
    },
    "تراکنش ایجاد شد و موعد بعدی به‌روز شد"
  );
});
