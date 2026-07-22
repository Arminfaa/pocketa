import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const to = process.env.MAIL_TO;
const from = process.env.MAIL_FROM || user;

if (!host || !user || !pass || !to) {
  console.error("Missing SMTP_HOST, SMTP_USER, SMTP_PASS, or MAIL_TO");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

console.log("Verifying SMTP connection...");
await transporter.verify();
console.log("SMTP OK. Sending test email...");

const info = await transporter.sendMail({
  from: `"Pocketa" <${from}>`,
  to,
  subject: "Pocketa — تست ارسال ایمیل",
  text: "این یک ایمیل تستی از Pocketa است. اگر این را می‌بینی، SMTP هاست درست کار می‌کند.",
  html: `
    <div style="font-family: Tahoma, sans-serif; direction: rtl; text-align: right;">
      <h2>تست ارسال ایمیل Pocketa</h2>
      <p>اگر این ایمیل را می‌بینی، SMTP هاست درست کار می‌کند.</p>
      <p style="color:#666;font-size:12px;">ارسال‌شده در ${new Date().toISOString()}</p>
    </div>
  `,
});

console.log("Sent:", info.messageId);
console.log("Response:", info.response);
