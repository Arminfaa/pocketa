import type { CookieOptions, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { asyncHandler } from "../middleware/asyncHandler";
import { env } from "../config/env";
import { sendSuccess } from "../utils/apiResponse";
import { AppError } from "../utils/AppError";
import { RegisterSchema, LoginSchema, ChangePasswordSchema } from "../validations/auth";
import { UserModel } from "../models/User";
import { CategoryModel } from "../models/Category";
import { RefreshTokenModel } from "../models/RefreshToken";
import { BankAccountModel } from "../models/BankAccount";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";
const ACCESS_COOKIE_PATH = "/";
const REFRESH_COOKIE_PATH = "/api/auth";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function tokenExpiryToDate(exp: string): Date {
  // Supported by JWT: e.g. 15m, 30d. Simple parser for production use-cases in this demo.
  const match = /^(\d+)([mhd])$/i.exec(exp.trim());
  if (!match) return new Date(Date.now() + 1000 * 60 * 30);
  const value = Number(match[1]);
  const unit = (match[2] ?? "m").toLowerCase();
  const ms =
    unit === "m"
      ? value * 60_000
      : unit === "h"
        ? value * 3_600_000
        : unit === "d"
          ? value * 86_400_000
          : value;
  return new Date(Date.now() + ms);
}

function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as any);
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as any);
}

function baseCookieOptions(): CookieOptions {
  // First-party (Vercel /api rewrite → Render): SameSite=Lax + Secure.
  // True cross-site API calls need SameSite=None + Secure (COOKIE_SAMESITE=none).
  // iOS Home Screen PWAs often discard SameSite=None cookies between launches.
  const sameSite = env.COOKIE_SAMESITE;
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || sameSite === "none",
    sameSite,
  };
}

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  refreshExpiresAt: Date
) {
  const accessExpiresAt = tokenExpiryToDate(env.JWT_ACCESS_EXPIRES_IN);
  const base = baseCookieOptions();

  res.cookie(ACCESS_COOKIE, accessToken, {
    ...base,
    path: ACCESS_COOKIE_PATH,
    maxAge: Math.max(accessExpiresAt.getTime() - Date.now(), 0),
  });

  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_COOKIE_PATH,
    maxAge: Math.max(refreshExpiresAt.getTime() - Date.now(), 0),
  });
}

function clearAuthCookies(res: Response) {
  const base = baseCookieOptions();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: ACCESS_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: REFRESH_COOKIE_PATH });
  // Clear legacy refresh cookie path from older deployments
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth/refresh" });
  // Clear cookies set with previous SameSite=None defaults (pre first-party proxy)
  if (base.sameSite !== "none") {
    const legacyNone: CookieOptions = { ...base, sameSite: "none", secure: true };
    res.clearCookie(ACCESS_COOKIE, { ...legacyNone, path: ACCESS_COOKIE_PATH });
    res.clearCookie(REFRESH_COOKIE, { ...legacyNone, path: REFRESH_COOKIE_PATH });
    res.clearCookie(REFRESH_COOKIE, { ...legacyNone, path: "/api/auth/refresh" });
  }
}

const defaultCategories = [
  // income
  { name: "حقوق", type: "income", icon: "BriefcaseBusiness", color: "#22c55e" },
  { name: "پروژه فریلنسری", type: "income", icon: "Wrench", color: "#34d399" },
  { name: "سرمایه گذاری", type: "income", icon: "TrendingUp", color: "#60a5fa" },
  { name: "هدیه", type: "income", icon: "Gift", color: "#a78bfa" },
  // expense
  { name: "خوراک", type: "expense", icon: "Utensils", color: "#ef4444" },
  { name: "حمل و نقل", type: "expense", icon: "Bus", color: "#f97316" },
  { name: "خرید", type: "expense", icon: "ShoppingCart", color: "#fb7185" },
  { name: "قبض‌ها", type: "expense", icon: "Receipt", color: "#f59e0b" },
  { name: "تفریح", type: "expense", icon: "Sparkles", color: "#38bdf8" },
  { name: "درمان", type: "expense", icon: "HeartPulse", color: "#f43f5e" },
  { name: "آموزش", type: "expense", icon: "BookOpen", color: "#8b5cf6" },
];

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { name, email, password } = parsed.data;

  const existing = await UserModel.findOne({ email });
  if (existing) throw new AppError(409, "این ایمیل قبلا ثبت شده است");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await UserModel.create({
    name,
    email,
    password: passwordHash,
  });

  // Seed default categories + primary bank account for this user.
  await Promise.all([
    CategoryModel.insertMany(
      defaultCategories.map((c) => ({
        userId: user._id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
      }))
    ),
    BankAccountModel.create({
      userId: user._id,
      name: "حساب اصلی",
      bankName: "",
      color: "#06b6d4",
      icon: "Landmark",
      initialBalance: 0,
      isActive: true,
    }),
  ]);

  return sendSuccess(res, { userId: user._id, email: user.email }, "ثبت نام با موفقیت انجام شد");
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { email, password } = parsed.data;
  const user = await UserModel.findOne({ email }).select("+password");
  if (!user) throw new AppError(401, "ایمیل یا رمز عبور نادرست است");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError(401, "ایمیل یا رمز عبور نادرست است");

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));
  const refreshTokenHash = sha256(refreshToken);
  const expiresAt = tokenExpiryToDate(env.JWT_REFRESH_EXPIRES_IN);

  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    expiresAt,
    revokedAt: null,
  });

  setAuthCookies(res, accessToken, refreshToken, expiresAt);

  const userSafe = { id: user._id, name: user.name, email: user.email };
  return sendSuccess(res, { user: userSafe }, "ورود با موفقیت انجام شد");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as jwt.JwtPayload;
      const userId = decoded.sub ? String(decoded.sub) : null;
      if (userId) {
        const tokenHash = sha256(refreshToken);
        await RefreshTokenModel.updateOne(
          { userId, tokenHash, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
      }
    } catch {
      // ignore token errors on logout
    }
  }

  clearAuthCookies(res);
  return sendSuccess(res, {}, "خروج با موفقیت انجام شد");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const user = await UserModel.findById(userId).select("name email createdAt updatedAt");
  if (!user) throw new AppError(404, "کاربر یافت نشد");

  return sendSuccess(res, {
    user: { id: user._id, name: user.name, email: user.email },
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = ChangePasswordSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { currentPassword, newPassword } = parsed.data;
  const user = await UserModel.findById(userId).select("+password");
  if (!user) throw new AppError(404, "کاربر یافت نشد");

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw new AppError(400, "رمز فعلی نادرست است");

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  // Invalidate other refresh sessions; keep current cookies so this device stays logged in
  await RefreshTokenModel.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  const accessToken = signAccessToken(String(user._id));
  const refreshToken = signRefreshToken(String(user._id));
  const refreshTokenHash = sha256(refreshToken);
  const expiresAt = tokenExpiryToDate(env.JWT_REFRESH_EXPIRES_IN);

  await RefreshTokenModel.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    expiresAt,
    revokedAt: null,
  });

  setAuthCookies(res, accessToken, refreshToken, expiresAt);

  return sendSuccess(res, {}, "رمز عبور با موفقیت تغییر کرد");
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) throw new AppError(401, "توکن refresh موجود نیست");

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "توکن refresh معتبر نیست");
  }

  const userId = payload.sub ? String(payload.sub) : null;
  if (!userId) throw new AppError(401, "توکن refresh معتبر نیست");

  const tokenHash = sha256(refreshToken);
  const record = await RefreshTokenModel.findOne({ userId, tokenHash });

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "توکن refresh منقضی شده است");
  }

  // rotate token
  record.revokedAt = new Date();
  await record.save();

  const newAccessToken = signAccessToken(userId);
  const newRefreshToken = signRefreshToken(userId);
  const newRefreshTokenHash = sha256(newRefreshToken);
  const newExpiresAt = tokenExpiryToDate(env.JWT_REFRESH_EXPIRES_IN);

  await RefreshTokenModel.create({
    userId,
    tokenHash: newRefreshTokenHash,
    expiresAt: newExpiresAt,
    revokedAt: null,
  });

  setAuthCookies(res, newAccessToken, newRefreshToken, newExpiresAt);

  return sendSuccess(res, {}, "توکن جدید صادر شد");
});
