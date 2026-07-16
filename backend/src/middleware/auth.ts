import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError(401, "عدم دسترسی"));
  }

  const token = header.slice("Bearer ".length);
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

