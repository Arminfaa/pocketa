import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type SendBody = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const port = Number(process.env.SMTP_PORT || 465);
  const secureEnv = process.env.SMTP_SECURE;
  const secure =
    secureEnv === undefined || secureEnv === ""
      ? port === 465
      : secureEnv === "true" || secureEnv === "1";
  const from = (process.env.MAIL_FROM?.trim() || user).trim();

  return { host, user, pass, port, secure, from };
}

function isAuthorized(req: Request): boolean {
  const expected = process.env.MAIL_RELAY_SECRET?.trim() ?? "";
  if (!expected) return false;
  const header = req.headers.get("x-mail-relay-secret")?.trim() ?? "";
  return header.length > 0 && header === expected;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const smtp = getSmtpConfig();
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return NextResponse.json(
      { success: false, message: "SMTP is not configured on Vercel" },
      { status: 503 }
    );
  }

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const to = body.to?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const text = body.text ?? "";
  const html = body.html ?? "";

  if (!to || !subject || (!text && !html)) {
    return NextResponse.json(
      { success: false, message: "to, subject, and text/html are required" },
      { status: 400 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    const info = await transporter.sendMail({
      from: `"Pocketa" <${smtp.from}>`,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Send failed";
    console.error("[mail-relay]", message);
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
