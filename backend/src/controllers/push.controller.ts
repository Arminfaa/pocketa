import { z } from "zod";
import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { PushSubscriptionModel } from "../models/PushSubscription";
import { getVapidPublicKey } from "../services/pushReminders";
import { isWebPushConfigured } from "../config/env";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const vapidPublicKey = asyncHandler(async (_req: Request, res: Response) => {
  if (!isWebPushConfigured()) {
    throw new AppError(503, "پوش نوتیفیکیشن پیکربندی نشده است");
  }
  return sendSuccess(res, { publicKey: getVapidPublicKey() });
});

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");
  if (!isWebPushConfigured()) {
    throw new AppError(503, "پوش نوتیفیکیشن پیکربندی نشده است");
  }

  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "اشتراک پوش نامعتبر است", parsed.error.flatten());

  await PushSubscriptionModel.findOneAndUpdate(
    { userId, endpoint: parsed.data.endpoint },
    {
      $set: {
        userId,
        endpoint: parsed.data.endpoint,
        keys: parsed.data.keys,
        userAgent: String(req.headers["user-agent"] ?? ""),
      },
    },
    { upsert: true, returnDocument: "after" }
  );

  return sendSuccess(res, { ok: true }, "یادآوری پوش فعال شد");
});

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint : "";
  if (!endpoint) throw new AppError(400, "endpoint لازم است");

  await PushSubscriptionModel.deleteOne({ userId, endpoint });
  return sendSuccess(res, { ok: true }, "اشتراک پوش حذف شد");
});

export const status = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const count = await PushSubscriptionModel.countDocuments({ userId });
  return sendSuccess(res, {
    configured: isWebPushConfigured(),
    subscribed: count > 0,
    subscriptionCount: count,
  });
});
