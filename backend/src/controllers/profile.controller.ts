import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { UserModel } from "../models/User";
import { UpdateProfileSchema } from "../validations/profile";
import { uploadImage } from "../services/upload.service";

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = UpdateProfileSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const updates: Record<string, unknown> = {};
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.avatar !== undefined) updates.avatar = parsed.data.avatar;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "هیچ فیلدی برای به‌روزرسانی ارسال نشده است");
  }

  const user = await UserModel.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select(
    "name email avatar createdAt updatedAt"
  );

  if (!user) throw new AppError(404, "کاربر یافت نشد");

  return sendSuccess(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar ?? null,
      },
    },
    "پروفایل به‌روزرسانی شد"
  );
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const file = req.file;
  if (!file) throw new AppError(400, "فایل تصویر ارسال نشده است");

  const uploaded = await uploadImage(file.path, file.originalname, "avatars");

  const user = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { avatar: uploaded.url } },
    { new: true }
  ).select("name email avatar createdAt updatedAt");

  if (!user) throw new AppError(404, "کاربر یافت نشد");

  return sendSuccess(
    res,
    {
      url: uploaded.url,
      provider: uploaded.provider,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar ?? null,
      },
    },
    "آواتار با موفقیت آپلود شد"
  );
});
