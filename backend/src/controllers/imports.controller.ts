import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { BankAccountModel } from "../models/BankAccount";
import { BankImportModel } from "../models/BankImport";
import { TransactionModel } from "../models/Transaction";
import { BankSmsConfirmSchema, BankSmsPreviewSchema } from "../validations/imports";
import { parseBankSmsText } from "../services/bank-sms-parser";
import {
  currentJalaliYear,
  defaultTitle,
  ensureBankSmsCategories,
  findExistingHashes,
} from "../services/bank-sms-import.service";
import { syncInitialBalanceToTarget } from "../services/account.service";
import { suggestCategoryForTitle } from "../services/category-suggest.service";

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankSmsPreviewSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { rawText, accountId } = parsed.data;
  const jalaliYear = parsed.data.jalaliYear ?? currentJalaliYear();

  const account = await BankAccountModel.findOne({ _id: accountId, userId, isActive: true });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const { items, failedBlocks } = parseBankSmsText(rawText, jalaliYear, accountId);
  const existing = await findExistingHashes(
    userId,
    items.map((i) => i.importHash)
  );

  const previewItems = items.map((item) => ({
    ...item,
    isDuplicate: existing.has(item.importHash),
    suggestedTitle: defaultTitle(item),
  }));

  const bankHint =
    previewItems.find((i) => i.bankName)?.bankName ??
    account.bankName ??
    "";

  return sendSuccess(res, {
    jalaliYear,
    accountId,
    bankHint,
    parsedCount: previewItems.length,
    duplicateCount: previewItems.filter((i) => i.isDuplicate).length,
    failedCount: failedBlocks.length,
    items: previewItems,
    failedBlocks,
  });
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankSmsConfirmSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { rawText, accountId, selectedHashes, syncBalance } = parsed.data;
  const jalaliYear = parsed.data.jalaliYear ?? currentJalaliYear();

  const account = await BankAccountModel.findOne({ _id: accountId, userId, isActive: true });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const { items } = parseBankSmsText(rawText, jalaliYear, accountId);
  const selected =
    selectedHashes && selectedHashes.length > 0
      ? items.filter((i) => selectedHashes.includes(i.importHash))
      : items;

  const existing = await findExistingHashes(
    userId,
    selected.map((i) => i.importHash)
  );

  const toImport = selected.filter((i) => !existing.has(i.importHash));
  const categories = await ensureBankSmsCategories(userId);

  const docs = await Promise.all(
    toImport.map(async (item) => {
      const title = defaultTitle(item);
      const suggested = await suggestCategoryForTitle({
        userId,
        title: `${title} ${item.rawSnippet}`,
        type: item.type,
      });
      const categoryId =
        suggested.suggestion?._id ??
        (item.type === "income" ? categories.income._id : categories.expense._id);

      return {
        userId,
        accountId,
        type: item.type,
        amount: item.amount,
        categoryId,
        title,
        description: item.rawSnippet,
        date: item.date,
        source: "bank_sms" as const,
        needsReview: true,
        tags: [] as string[],
        importHash: item.importHash,
        bankMeta: {
          bankName: item.bankName,
          accountHint: item.accountHint,
          balanceAfter: item.balanceAfter,
          time: item.time,
          rawSnippet: item.rawSnippet,
        },
      };
    })
  );

  let importedCount = 0;
  if (docs.length > 0) {
    try {
      const inserted = await TransactionModel.insertMany(docs, { ordered: false });
      importedCount = inserted.length;
    } catch (err: unknown) {
      // Partial success on duplicate key races
      const inserted =
        typeof err === "object" && err && "insertedDocs" in err
          ? (err as { insertedDocs?: unknown[] }).insertedDocs?.length ?? 0
          : 0;
      importedCount = inserted;
      if (importedCount === 0) {
        // rethrow unexpected errors
        const isDup =
          typeof err === "object" &&
          err &&
          "code" in err &&
          (err as { code?: number }).code === 11000;
        if (!isDup) throw err;
      }
    }
  }

  const bankHint = toImport.find((i) => i.bankName)?.bankName ?? account.bankName ?? "";

  await BankImportModel.create({
    userId,
    accountId,
    rawText,
    jalaliYear,
    parsedCount: selected.length,
    importedCount,
    skippedDuplicateCount: selected.length - toImport.length,
    bankHint,
  });

  let balanceSync: {
    previousBalance: number;
    balance: number;
    smsBalance: number;
  } | null = null;

  if (syncBalance) {
    const withBalance = [...toImport]
      .filter((i) => typeof i.balanceAfter === "number")
      .sort((a, b) => {
        const da = `${a.date} ${a.time ?? ""}`;
        const db = `${b.date} ${b.time ?? ""}`;
        return db.localeCompare(da);
      });
    const latest = withBalance[0]?.balanceAfter;
    if (typeof latest === "number") {
      const synced = await syncInitialBalanceToTarget(userId, accountId, latest);
      balanceSync = {
        previousBalance: synced.previousBalance,
        balance: synced.balance,
        smsBalance: latest,
      };
    }
  }

  return sendSuccess(
    res,
    {
      importedCount,
      skippedDuplicateCount: selected.length - toImport.length,
      parsedCount: selected.length,
      balanceSync,
    },
    `${importedCount} تراکنش از پیامک وارد شد`
  );
});
