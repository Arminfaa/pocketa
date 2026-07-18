import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";
import { BankAccountCreateSchema, BankAccountUpdateSchema } from "../validations/accounts";
import {
  adjustAccountBalanceToTarget,
  computeAccountBalance,
  createOpeningBalanceTransaction,
  ensureDefaultAccount,
} from "../services/account.service";
import { AdjustBalanceSchema } from "../validations/transactions";

function accountPayload(
  account: {
    _id: unknown;
    name: string;
    bankName?: string | null;
    color: string;
    icon: string;
    initialBalance: number;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  },
  balance: number,
  extra: Record<string, unknown> = {}
) {
  return {
    id: account._id,
    name: account.name,
    bankName: account.bankName ?? "",
    color: account.color,
    icon: account.icon,
    initialBalance: 0,
    isActive: account.isActive,
    balance,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    ...extra,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  await ensureDefaultAccount(userId);

  const includeInactive = String(req.query.includeInactive ?? "") === "true";
  const filter: Record<string, unknown> = { userId };
  if (!includeInactive) filter.isActive = true;

  const accounts = await BankAccountModel.find(filter).sort({ createdAt: 1 });

  const items = await Promise.all(
    accounts.map(async (account) => {
      const balance = await computeAccountBalance(userId, account._id);
      return accountPayload(account, balance);
    })
  );

  return sendSuccess(res, { items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankAccountCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const openingBalance = parsed.data.initialBalance;

  // Opening cash is an income transaction — never a hidden initialBalance plug.
  const account = await BankAccountModel.create({
    userId,
    name: parsed.data.name,
    bankName: parsed.data.bankName ?? "",
    color: parsed.data.color,
    icon: parsed.data.icon,
    initialBalance: 0,
    isActive: true,
  });

  if (openingBalance > 0) {
    await createOpeningBalanceTransaction(userId, account._id, openingBalance);
  }

  const balance = await computeAccountBalance(userId, account._id);

  return sendSuccess(
    res,
    {
      item: accountPayload(account, balance),
    },
    "حساب بانکی ایجاد شد",
    201
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankAccountUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  // initialBalance updates are ignored — use POST /:id/adjust-balance instead.
  const account = await BankAccountModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.bankName !== undefined ? { bankName: parsed.data.bankName ?? "" } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
        ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
        initialBalance: 0,
      },
    },
    { new: true }
  );

  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const balance = await computeAccountBalance(userId, account._id);

  return sendSuccess(res, {
    item: accountPayload(account, balance),
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const account = await BankAccountModel.findOne({ _id: id, userId });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const activeCount = await BankAccountModel.countDocuments({ userId, isActive: true });
  if (account.isActive && activeCount <= 1) {
    throw new AppError(400, "حداقل یک حساب فعال باید باقی بماند");
  }

  // Soft delete — keep historical transactions linked.
  account.isActive = false;
  await account.save();

  return sendSuccess(res, { id }, "حساب بانکی غیرفعال شد");
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const account = await BankAccountModel.findOne({ _id: id, userId });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const [balance, txCount] = await Promise.all([
    computeAccountBalance(userId, account._id),
    TransactionModel.countDocuments({ userId, accountId: account._id }),
  ]);

  return sendSuccess(res, {
    item: accountPayload(account, balance, { transactionCount: txCount }),
  });
});

/** Set book balance via adjustment transaction (income/expense for the delta). */
export const adjustBalance = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = AdjustBalanceSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const account = await BankAccountModel.findOne({ _id: id, userId });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  try {
    const result = await adjustAccountBalanceToTarget(
      userId,
      account._id,
      parsed.data.targetBalance
    );
    return sendSuccess(
      res,
      {
        item: accountPayload(account, result.balance, {
          previousBalance: result.previousBalance,
          adjustment: result.adjustment,
        }),
      },
      result.adjustment
        ? result.adjustment.type === "expense"
          ? `تراکنش هزینه تعدیل به مبلغ ${result.adjustment.amount.toLocaleString("en-US")} ثبت شد`
          : `تراکنش درآمد تعدیل به مبلغ ${result.adjustment.amount.toLocaleString("en-US")} ثبت شد`
        : "موجودی از قبل با عدد واردشده یکی بود"
    );
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_TARGET_BALANCE") {
      throw new AppError(400, "مبلغ موجودی معتبر نیست");
    }
    throw new AppError(404, "حساب بانکی یافت نشد");
  }
});
