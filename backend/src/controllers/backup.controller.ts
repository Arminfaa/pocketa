import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { buildUserBackup, restoreUserBackup } from "../services/backup.service";
import { BackupPayloadSchema } from "../validations/backup";

function filenameStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "backup";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}_${h}-${min}`;
}

export const downloadBackup = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const backup = await buildUserBackup(userId);
  const stamp = filenameStamp(backup.exportedAt);
  const filename = `pocketa-backup-${stamp}.json`;

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(JSON.stringify(backup, null, 2));
});

export const getBackupJson = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const backup = await buildUserBackup(userId);
  return sendSuccess(res, { backup }, "بکاپ آماده شد");
});

export const restoreBackup = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const raw = req.body as { backup?: unknown } | unknown;
  const candidate =
    raw && typeof raw === "object" && "backup" in raw && (raw as { backup: unknown }).backup
      ? (raw as { backup: unknown }).backup
      : raw;

  const parsed = BackupPayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new AppError(400, "فایل بکاپ معتبر نیست", parsed.error.flatten());
  }

  const backup = parsed.data;
  if (backup.accounts.length === 0 && backup.categories.length === 0) {
    throw new AppError(400, "بکاپ خالی است یا ساختار ناقص دارد");
  }

  const summary = await restoreUserBackup(userId, backup);
  return sendSuccess(res, { summary }, "بازیابی با موفقیت انجام شد");
});