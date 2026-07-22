import { env, isMailConfigured } from "../config/env";
import { AppError } from "../utils/AppError";
import nodemailer from "nodemailer";

function getFromAddress(): string {
  const from = env.MAIL_FROM.trim() || env.SMTP_USER;
  return `"Pocketa" <${from}>`;
}

function buildPasswordResetContent(params: { to: string; resetUrl: string; name?: string }) {
  const greeting = params.name ? `${params.name} عزیز` : "کاربر عزیز";
  const subject = "بازیابی رمز عبور — Pocketa";
  const text = [
    `${greeting}،`,
    "",
    "درخواست بازیابی رمز عبور برای حساب Pocketa دریافت شد.",
    "برای تعیین رمز جدید روی لینک زیر کلیک کنید (اعتبار: ۱ ساعت):",
    params.resetUrl,
    "",
    "اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید.",
  ].join("\n");
  const html = `
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
    `;
  return { subject, text, html };
}

async function sendViaRelay(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const url = env.MAIL_RELAY_URL.trim();
  const secret = env.MAIL_RELAY_SECRET.trim();
  if (!url || !secret) {
    throw new AppError(503, "ارسال ایمیل پیکربندی نشده است");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mail-relay-secret": secret,
    },
    body: JSON.stringify(payload),
  });

  let data: { success?: boolean; message?: string } = {};
  try {
    data = (await res.json()) as { success?: boolean; message?: string };
  } catch {
    // ignore JSON parse errors
  }

  if (!res.ok || data.success === false) {
    throw new AppError(
      res.status >= 400 && res.status < 600 ? res.status : 502,
      data.message || "ارسال ایمیل از طریق رله ناموفق بود"
    );
  }
}

async function sendViaSmtp(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new AppError(503, "ارسال ایمیل پیکربندی نشده است");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: getFromAddress(),
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  name?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new AppError(503, "ارسال ایمیل پیکربندی نشده است");
  }

  const content = buildPasswordResetContent(params);
  const payload = {
    to: params.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  };

  if (env.MAIL_RELAY_URL.trim() && env.MAIL_RELAY_SECRET.trim()) {
    await sendViaRelay(payload);
    return;
  }

  await sendViaSmtp(payload);
}
