import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

function extractAccessToken(req: Request): string | null {
  const cookieToken = req.cookies?.accessToken as string | undefined;
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractAccessToken(req);
  if (!token) {
    return next(new AppError(401, "عدم دسترسی"));
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    const userId = payload.sub;
    if (!userId) return next(new AppError(401, "عدم دسترسی"));

    req.user = { userId: String(userId) };
    next();
  } catch {
    next(new AppError(401, "توکن معتبر نیست"));
  }
}
