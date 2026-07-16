import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { BankAccountModel } from "../models/BankAccount";
import { TransactionModel } from "../models/Transaction";
import { BankAccountCreateSchema, BankAccountUpdateSchema } from "../validations/accounts";
import { computeAccountBalance, ensureDefaultAccount, findLatestSmsBalance, syncInitialBalanceToTarget } from "../services/account.service";
import { SyncBalanceSchema } from "../validations/transactions";

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
      const balance = await computeAccountBalance(userId, account._id, account.initialBalance);
      return {
        id: account._id,
        name: account.name,
        bankName: account.bankName ?? "",
        color: account.color,
        icon: account.icon,
        initialBalance: account.initialBalance,
        isActive: account.isActive,
        balance,
        createdAt: (account as { createdAt?: Date }).createdAt,
        updatedAt: (account as { updatedAt?: Date }).updatedAt,
      };
    })
  );

  return sendSuccess(res, { items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankAccountCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const account = await BankAccountModel.create({
    userId,
    name: parsed.data.name,
    bankName: parsed.data.bankName ?? "",
    color: parsed.data.color,
    icon: parsed.data.icon,
    initialBalance: parsed.data.initialBalance,
    isActive: true,
  });

  return sendSuccess(
    res,
    {
      item: {
        id: account._id,
        name: account.name,
        bankName: account.bankName ?? "",
        color: account.color,
        icon: account.icon,
        initialBalance: account.initialBalance,
        isActive: account.isActive,
        balance: account.initialBalance,
      },
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
  const account = await BankAccountModel.findOneAndUpdate(
    { _id: id, userId },
    {
      $set: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.bankName !== undefined ? { bankName: parsed.data.bankName ?? "" } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
        ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon } : {}),
        ...(parsed.data.initialBalance !== undefined
          ? { initialBalance: parsed.data.initialBalance }
          : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    },
    { new: true }
  );

  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const balance = await computeAccountBalance(userId, account._id, account.initialBalance);

  return sendSuccess(res, {
    item: {
      id: account._id,
      name: account.name,
      bankName: account.bankName ?? "",
      color: account.color,
      icon: account.icon,
      initialBalance: account.initialBalance,
      isActive: account.isActive,
      balance,
    },
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
    computeAccountBalance(userId, account._id, account.initialBalance),
    TransactionModel.countDocuments({ userId, accountId: account._id }),
  ]);

  return sendSuccess(res, {
    item: {
      id: account._id,
      name: account.name,
      bankName: account.bankName ?? "",
      color: account.color,
      icon: account.icon,
      initialBalance: account.initialBalance,
      isActive: account.isActive,
      balance,
      transactionCount: txCount,
    },
  });
});

export const syncBalance = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = SyncBalanceSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const account = await BankAccountModel.findOne({ _id: id, userId });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  let target = parsed.data.balanceAfter;
  if (target === undefined) {
    const latest = await findLatestSmsBalance(userId, account._id);
    if (latest === null) {
      throw new AppError(400, "مانده‌ای از پیامک بانکی برای این حساب یافت نشد");
    }
    target = latest;
  }

  try {
    const result = await syncInitialBalanceToTarget(userId, account._id, target);
    return sendSuccess(
      res,
      {
        item: {
          id: account._id,
          name: account.name,
          bankName: account.bankName ?? "",
          color: account.color,
          icon: account.icon,
          initialBalance: result.initialBalance,
          isActive: account.isActive,
          balance: result.balance,
          previousBalance: result.previousBalance,
          smsBalance: target,
        },
      },
      "موجودی حساب با مانده پیامک همگام شد"
    );
  } catch {
    throw new AppError(404, "حساب بانکی یافت نشد");
  }
});
