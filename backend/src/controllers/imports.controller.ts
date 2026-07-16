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

  const { rawText, accountId, selectedHashes } = parsed.data;
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

  const docs = toImport.map((item) => ({
    userId,
    accountId,
    type: item.type,
    amount: item.amount,
    categoryId: item.type === "income" ? categories.income._id : categories.expense._id,
    title: defaultTitle(item),
    description: item.rawSnippet,
    date: item.date,
    source: "bank_sms" as const,
    needsReview: true,
    importHash: item.importHash,
    bankMeta: {
      bankName: item.bankName,
      accountHint: item.accountHint,
      balanceAfter: item.balanceAfter,
      time: item.time,
      rawSnippet: item.rawSnippet,
    },
  }));

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

  return sendSuccess(
    res,
    {
      importedCount,
      skippedDuplicateCount: selected.length - toImport.length,
      parsedCount: selected.length,
    },
    `${importedCount} تراکنش از پیامک وارد شد`
  );
});
