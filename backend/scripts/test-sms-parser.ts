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

const r3 = parseBankSmsText(cardSample, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "card_receipt",
});
if (r3.items.length !== 1) throw new Error(`card: expected 1, got ${r3.items.length}`);
const c = r3.items[0]!;
if (c.type !== "expense") throw new Error(`card: expected expense, got ${c.type}`);
if (c.amount !== 1_000_000) throw new Error(`card: expected 1e6 toman, got ${c.amount}`);
if (c.date !== "1405/04/27" || c.time !== "00:11") throw new Error(`card: bad date/time ${c.date} ${c.time}`);
if (c.skipReview) throw new Error("card: should need naming review");
if (!c.needsFee) throw new Error("card: expense should require fee at naming");
if (c.transferAmount !== 1_000_000) {
  throw new Error(`card: transferAmount expected 1e6, got ${c.transferAmount}`);
}
if (c.suggestedTitle !== "واریز به لیلا پویانژاد") {
  throw new Error(`card: bad title ${c.suggestedTitle}`);
}
console.log("OK: card-to-card expense titled and needs review + fee");

const r4 = parseBankSmsText(cardSample, 1405, "acc1", {
  userName: "لیلا پویانژاد",
  mode: "card_receipt",
});
if (r4.items[0]?.type !== "income") throw new Error("card reverse: expected income");
if (r4.items[0]?.suggestedTitle !== "واریز از آرمین فاتحی") {
  throw new Error(`card reverse: bad title ${r4.items[0]?.suggestedTitle}`);
}
console.log("OK: card-to-card income when user is destination");

const r5 = parseBankSmsText(cardFail, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "card_receipt",
});
if (r5.items.length !== 0) throw new Error(`failed status should skip, got ${r5.items.length}`);
console.log("OK: unsuccessful card transfer skipped");

const cardRial = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 نام مقصد: لیلا پویانژاد
 مبلغ: 10,000,000ریال
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 00:11:54 1405/04/27`;
const r6 = parseBankSmsText(cardRial, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "card_receipt",
});
if (r6.items[0]?.amount !== 1_000_000) {
  throw new Error(`card rial: expected 1e6 toman after ÷10, got ${r6.items[0]?.amount}`);
}
if (r6.items[0]?.amountRial !== 10_000_000) {
  throw new Error(`card rial: expected amountRial 1e7, got ${r6.items[0]?.amountRial}`);
}
console.log("OK: card-to-card rial amount converted to toman");

const cardWithFee = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 کارت مقصد: 7317 - ∗∗∗∗ - ∗∗86 - 6219
 نام مقصد: محدثه کشانی
 مبلغ: 642,500تومان
شماره پیگیری: 737795
شماره ارجاع: 72261566541
کارت مبدا: 8281 - ∗∗∗∗ - ∗∗29 - 5022
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 19:31:12 1405/04/27
کارمزد: 720تومان`;
const r7 = parseBankSmsText(cardWithFee, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "card_receipt",
});
if (r7.items.length !== 1) throw new Error(`fee card: expected 1, got ${r7.items.length}`);
if (r7.items[0]?.transferAmount !== 642_500) {
  throw new Error(`fee card: transferAmount expected 642500, got ${r7.items[0]?.transferAmount}`);
}
if (r7.items[0]?.feeAmount !== 720) {
  throw new Error(`fee card: feeAmount expected 720, got ${r7.items[0]?.feeAmount}`);
}
if (r7.items[0]?.amount !== 643_220) {
  throw new Error(`fee card: amount expected 643220, got ${r7.items[0]?.amount}`);
}
if (r7.items[0]?.type !== "expense") throw new Error("fee card: expected expense");
if (!r7.items[0]?.needsFee) throw new Error("fee card: still needs fee confirmation at naming");
console.log("OK: card receipt fee added into expense amount");

const cardNoFeeText = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 کارت مقصد: 7317 - ∗∗∗∗ - ∗∗86 - 6219
 نام مقصد: محدثه کشانی
 مبلغ: 642,500تومان
شماره پیگیری: 737795
شماره ارجاع: 72261566541
کارت مبدا: 8281 - ∗∗∗∗ - ∗∗29 - 5022
نام مبدا: آرمین فاتحی
تاریخ و ساعت: 19:31:12 1405/04/27`;
const r8 = parseBankSmsText(cardNoFeeText, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "card_receipt",
});
if (r8.items[0]?.amount !== 642_500) {
  throw new Error(`no-fee card: amount should stay transfer-only, got ${r8.items[0]?.amount}`);
}
if (r8.items[0]?.feeAmount) throw new Error("no-fee card: feeAmount should be empty");
if (!r8.items[0]?.needsFee) throw new Error("no-fee card: needsFee required");
console.log("OK: card receipt without fee text defers fee to naming");

const smsModeIgnoresCard = parseBankSmsText(cardSample, 1405, "acc1", {
  userName: "آرمین فاتحی",
  mode: "sms",
});
if (smsModeIgnoresCard.items.some((i) => i.parser === "card_transfer")) {
  throw new Error("sms mode should not parse card receipts");
}
console.log("OK: sms mode ignores card receipts");

const compactSample = `47001850970602
مبلغ:49,500,000+
مانده:49,500,000
04/20
12:31`;
const rCompact = parseBankSmsText(compactSample, 1405, "acc1");
if (rCompact.items.length !== 1) {
  throw new Error(`compact: expected 1, got ${rCompact.items.length}`);
}
const compact = rCompact.items[0]!;
if (compact.parser !== "compact_sms") throw new Error(`compact: bad parser ${compact.parser}`);
if (compact.type !== "income") throw new Error(`compact: expected income, got ${compact.type}`);
if (compact.amount !== 4_950_000) {
  throw new Error(`compact: expected 4950000 toman, got ${compact.amount}`);
}
if (compact.balanceAfter !== 4_950_000) {
  throw new Error(`compact: bad balanceAfter ${compact.balanceAfter}`);
}
if (compact.date !== "1405/04/20" || compact.time !== "12:31") {
  throw new Error(`compact: bad date/time ${compact.date} ${compact.time}`);
}
if (compact.accountHint !== "47001850970602") {
  throw new Error(`compact: bad accountHint ${compact.accountHint}`);
}
console.log("OK: compact SMS income parsed");

const compactExpense = `47001850970602
مبلغ:1,000,000-
مانده:48,500,000
04/21
09:05`;
const rCompactExp = parseBankSmsText(compactExpense, 1405, "acc1");
if (rCompactExp.items[0]?.type !== "expense" || rCompactExp.items[0]?.amount !== 100_000) {
  throw new Error(`compact expense unexpected: ${JSON.stringify(rCompactExp.items[0])}`);
}
console.log("OK: compact SMS expense parsed");
