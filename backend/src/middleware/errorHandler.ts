import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/AppError";
import { sendError } from "../utils/apiResponse";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.details);
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return sendError(res, 400, "حجم فایل نباید بیشتر از ۵ مگابایت باشد");
    }
    return sendError(res, 400, "خطا در آپلود فایل");
  }

  if (typeof err === "object" && err && "issues" in err) {
    return sendError(res, 400, "خطا در اعتبارسنجی داده‌ها", err);
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return sendError(res, 500, "خطای داخلی سرور");
}
