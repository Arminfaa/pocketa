import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { sendError } from "../utils/apiResponse";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message, err.details);
  }

  if (typeof err === "object" && err && "issues" in err) {
    return sendError(res, 400, "خطا در اعتبارسنجی داده‌ها", err);
  }

  if (typeof err === "object" && err) {
    const name = "name" in err ? String(err.name) : "";
    if (name === "ValidationError" || name === "CastError") {
      const message =
        "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "خطا در اعتبارسنجی داده‌ها";
      return sendError(res, 400, message, err);
    }
    if ("code" in err && (err as { code: number }).code === 11000) {
      return sendError(res, 400, "داده تکراری است", err);
    }
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return sendError(res, 500, "خطای داخلی سرور");
}
