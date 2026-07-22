import nodemailer from "nodemailer";
import { env, isMailConfigured } from "../config/env";
import { AppError } from "../utils/AppError";

function getFromAddress(): string {
  const from = env.MAIL_FROM.trim() || env.SMTP_USER;
  return `"Pocketa" <${from}>`;
}

function createTransporter() {
  if (!isMailConfigured()) {
    throw new AppError(503, "ارسال ایمیل پیکربندی نشده است");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  name?: string;
}): Promise<void> {
  const transporter = createTransporter();
  const greeting = params.name ? `${params.name} عزیز` : "کاربر عزیز";

  await transporter.sendMail({
    from: getFromAddress(),
    to: params.to,
    subject: "بازیابی رمز عبور — Pocketa",
    text: [
      `${greeting}،`,
      "",
      "درخواست بازیابی رمز عبور برای حساب Pocketa دریافت شد.",
      "برای تعیین رمز جدید روی لینک زیر کلیک کنید (اعتبار: ۱ ساعت):",
      params.resetUrl,
      "",
      "اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.",
    ].join("\n"),
    html: `
      <div style="font-family: Tahoma, Arial, sans-serif; direction: rtl; text-align: right; max-width: 520px; margin: 0 auto; color: #0f172a;">
        <h2 style="margin: 0 0 12px; color: #0e7490;">بازیابی رمز عبور</h2>
        <p style="margin: 0 0 12px;">${greeting}،</p>
        <p style="margin: 0 0 16px;">درخواست بازیابی رمز عبور برای حساب <strong>Pocketa</strong> دریافت شد. برای تعیین رمز جدید روی دکمه زیر کلیک کنید.</p>
        <p style="margin: 0 0 20px;">
          <a href="${params.resetUrl}" style="display: inline-block; background: #06b6d4; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-weight: bold;">
            تعیین رمز جدید
          </a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">این لینک تا ۱ ساعت معتبر است.</p>
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.</p>
      </div>
    `,
  });
}
