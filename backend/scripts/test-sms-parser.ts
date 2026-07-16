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
