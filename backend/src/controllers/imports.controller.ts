import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { BankAccountModel } from "../models/BankAccount";
import { BankImportModel } from "../models/BankImport";
import { TransactionModel } from "../models/Transaction";
import { UserModel } from "../models/User";
import { BankSmsConfirmSchema, BankSmsPreviewSchema } from "../validations/imports";
import { parseBankSmsText } from "../services/bank-sms-parser";
import {
  currentJalaliYear,
  defaultTitle,
  ensureBankSmsCategories,
  findExistingHashes,
  findNearDuplicateImportKeys,
  nearDuplicateAmount,
  nearDuplicateKey,
} from "../services/bank-sms-import.service";
import { suggestCategoryForTitle } from "../services/category-suggest.service";

async function loadUserName(userId: string): Promise<string> {
  const user = await UserModel.findById(userId).select("name").lean();
  return user?.name?.trim() ?? "";
}

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = BankSmsPreviewSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { rawText, accountId } = parsed.data;
  const jalaliYear = parsed.data.jalaliYear ?? currentJalaliYear();
  const mode = parsed.data.mode ?? "sms";

  const account = await BankAccountModel.findOne({ _id: accountId, userId, isActive: true });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const userName = await loadUserName(userId);
  const { items, failedBlocks } = parseBankSmsText(rawText, jalaliYear, accountId, {
    userName,
    mode,
  });
  const [existing, nearDupes] = await Promise.all([
    findExistingHashes(
      userId,
      items.map((i) => i.importHash)
    ),
    findNearDuplicateImportKeys(userId, accountId, items),
  ]);

  const seenNearKeys = new Set<string>();
  const previewItems = items.map((item) => {
    const nearKey = nearDuplicateKey({
      accountId,
      type: item.type,
      amount: nearDuplicateAmount(item),
      date: item.date,
    });
    const dupInBatch = seenNearKeys.has(nearKey);
    seenNearKeys.add(nearKey);
    return {
      ...item,
      isDuplicate:
        existing.has(item.importHash) || nearDupes.has(nearKey) || dupInBatch,
      suggestedTitle: defaultTitle(item),
      skipReview: Boolean(item.skipReview),
    };
  });

  const bankHint =
    previewItems.find((i) => i.bankName)?.bankName ??
    account.bankName ??
    "";

  return sendSuccess(res, {
    jalaliYear,
    accountId,
    mode,
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
  const mode = parsed.data.mode ?? "sms";

  const account = await BankAccountModel.findOne({ _id: accountId, userId, isActive: true });
  if (!account) throw new AppError(404, "حساب بانکی یافت نشد");

  const userName = await loadUserName(userId);
  const { items } = parseBankSmsText(rawText, jalaliYear, accountId, { userName, mode });
  const selected =
    selectedHashes && selectedHashes.length > 0
      ? items.filter((i) => selectedHashes.includes(i.importHash))
      : items;

  const [existing, nearDupes] = await Promise.all([
    findExistingHashes(
      userId,
      selected.map((i) => i.importHash)
    ),
    findNearDuplicateImportKeys(userId, accountId, selected),
  ]);

  const seenNearKeys = new Set<string>();
  const toImport = selected.filter((i) => {
    if (existing.has(i.importHash)) return false;
    const nearKey = nearDuplicateKey({
      accountId,
      type: i.type,
      amount: nearDuplicateAmount(i),
      date: i.date,
    });
    if (nearDupes.has(nearKey) || seenNearKeys.has(nearKey)) return false;
    seenNearKeys.add(nearKey);
    return true;
  });
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

      const feeNote =
        item.feeAmount && item.feeAmount > 0
          ? `\nکارمزد: ${item.feeAmount.toLocaleString("en-US")} تومان` +
            (item.transferAmount
              ? ` · مبلغ انتقال: ${item.transferAmount.toLocaleString("en-US")} تومان`
              : "")
          : "";

      return {
        userId,
        accountId,
        type: item.type,
        amount: item.amount,
        categoryId,
        title,
        description: `${item.rawSnippet}${feeNote}`,
        date: item.date,
        time: item.time ? String(item.time).slice(0, 5) : "",
        source: "bank_sms" as const,
        needsReview: item.skipReview ? false : true,
        tags: [] as string[],
        importHash: item.importHash,
        bankMeta: {
          bankName: item.bankName,
          accountHint: item.accountHint,
          balanceAfter: item.balanceAfter,
          time: item.time,
          rawSnippet: item.rawSnippet,
          feeAmount: item.feeAmount,
          transferAmount: item.transferAmount,
          needsFee: Boolean(item.needsFee),
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
