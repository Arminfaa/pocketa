import { parseBankSmsText } from "../src/services/bank-sms-parser";

const sample = `بانك ملي ايران
انتقال:10,712,200-
حساب:00006
مانده:169,314
0316-10:30
بانك ملي ايران
اصـلاحيه:10,712,200+
حساب:00006
مانده:10,881,514
0316-10:30
بانك ملي ايران
انتقال:10,712,200-
حساب:00006
مانده:169,314
0316-10:30`;

const r = parseBankSmsText(sample, 1405, "acc1");
console.log("count", r.items.length, "failed", r.failedBlocks.length);
console.log(
  r.items.map((i) => ({
    type: i.type,
    amount: i.amount,
    date: i.date,
    time: i.time,
    balanceAfter: i.balanceAfter,
    isCorrection: i.isCorrection ?? false,
    snippet: i.rawSnippet.split("\n").slice(0, 2).join(" / "),
  }))
);

if (r.items.length !== 1) {
  throw new Error(`EXPECTED 1 item (final expense only), got ${r.items.length}`);
}
if (r.items[0]?.type !== "expense" || r.items[0]?.amount !== 1071220) {
  throw new Error(`UNEXPECTED item: ${JSON.stringify(r.items[0])}`);
}
console.log("OK: correction pair cancelled, final transfer kept");

const pairOnly = `بانك ملي ايران
انتقال:10,712,200-
حساب:00006
مانده:169,314
0316-10:30
بانك ملي ايران
اصـلاحيه:10,712,200+
حساب:00006
مانده:10,881,514
0316-10:30`;
const r2 = parseBankSmsText(pairOnly, 1405, "acc1");
if (r2.items.length !== 0) {
  throw new Error(`EXPECTED 0 items for reversed pair only, got ${r2.items.length}`);
}
console.log("OK: pair-only cancelled to empty");

const cardSample = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 کارت مقصد: 8541 - ∗∗∗∗ - ∗∗99 - 6037
 نام مقصد: لیلا پویانژاد
 مبلغ: 1,000,000تومان 
شماره پیگیری: 268395
شماره ارجاع: 72233131689
کارت مبدا: 8281 - ∗∗∗∗ - ∗∗29 - 5022
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 00:11:54 1405/04/27`;

const cardFail = `رسید کارت به کارت
 وضعیت تراکنش: ناموفق
 نام مقصد: لیلا پویانژاد
 مبلغ: 1,000,000تومان 
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 00:11:54 1405/04/27`;

const r3 = parseBankSmsText(cardSample, 1405, "acc1", { userName: "آرمین فاتحی" });
if (r3.items.length !== 1) throw new Error(`card: expected 1, got ${r3.items.length}`);
const c = r3.items[0]!;
if (c.type !== "expense") throw new Error(`card: expected expense, got ${c.type}`);
if (c.amount !== 1_000_000) throw new Error(`card: expected 1e6 toman, got ${c.amount}`);
if (c.date !== "1405/04/27" || c.time !== "00:11") throw new Error(`card: bad date/time ${c.date} ${c.time}`);
if (!c.skipReview) throw new Error("card: skipReview expected");
if (c.suggestedTitle !== "واریز به لیلا پویانژاد") {
  throw new Error(`card: bad title ${c.suggestedTitle}`);
}
console.log("OK: card-to-card expense titled and skipReview");

const r4 = parseBankSmsText(cardSample, 1405, "acc1", { userName: "لیلا پویانژاد" });
if (r4.items[0]?.type !== "income") throw new Error("card reverse: expected income");
if (r4.items[0]?.suggestedTitle !== "واریز از آرمین فاتحی") {
  throw new Error(`card reverse: bad title ${r4.items[0]?.suggestedTitle}`);
}
console.log("OK: card-to-card income when user is destination");

const r5 = parseBankSmsText(cardFail, 1405, "acc1", { userName: "آرمین فاتحی" });
if (r5.items.length !== 0) throw new Error(`failed status should skip, got ${r5.items.length}`);
console.log("OK: unsuccessful card transfer skipped");

const cardRial = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 نام مقصد: لیلا پویانژاد
 مبلغ: 10,000,000ریال
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 00:11:54 1405/04/27`;
const r6 = parseBankSmsText(cardRial, 1405, "acc1", { userName: "آرمین فاتحی" });
if (r6.items[0]?.amount !== 1_000_000) {
  throw new Error(`card rial: expected 1e6 toman after ÷10, got ${r6.items[0]?.amount}`);
}
if (r6.items[0]?.amountRial !== 10_000_000) {
  throw new Error(`card rial: expected amountRial 1e7, got ${r6.items[0]?.amountRial}`);
}
console.log("OK: card-to-card rial amount converted to toman");
