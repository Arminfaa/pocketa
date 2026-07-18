import { z } from "zod";

export const RegisterSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  email: z.string().email().max(120).trim(),
  password: z.string().min(8).max(200),
});

export const LoginSchema = z.object({
  email: z.string().email().max(120).trim(),
  password: z.string().min(1).max(200),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
    confirmPassword: z.string().min(1).max(200),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "تکرار رمز جدید یکسان نیست",
        path: ["confirmPassword"],
      });
    }
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "رمز جدید باید با رمز فعلی فرق داشته باشد",
        path: ["newPassword"],
      });
    }
  });
