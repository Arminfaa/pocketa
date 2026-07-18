import {
  extractTimeFromText,
  normalizeTime,
  resolveTransactionTime,
} from "../src/utils/transactionTime";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(normalizeTime("9:05") === "09:05", "pad hour");
assert(normalizeTime("12:31:00") === "12:31", "strip seconds");
assert(normalizeTime("25:00") === "", "invalid hour");

assert(
  extractTimeFromText("تاریخ و ساعت: 00:11:54 1405/04/27") === "00:11",
  "card receipt"
);
assert(extractTimeFromText("0316-10:30") === "10:30", "melli short");
assert(extractTimeFromText("04/20_12:31\nمانده:1") === "12:31", "pasargad");
assert(
  extractTimeFromText("4700\nمبلغ:1+\nمانده:1\n04/20\n12:31") === "12:31",
  "compact"
);
assert(extractTimeFromText("ساعت: 19:31:12") === "19:31", "saat label");

assert(
  resolveTransactionTime({ bankMetaTime: "08:15", rawSnippet: "ساعت: 19:00" }) ===
    "08:15",
  "prefer bankMeta.time"
);
assert(
  resolveTransactionTime({
    rawSnippet: "بانك ملي\nانتقال:1-\n0316-10:30",
  }) === "10:30",
  "parse snippet"
);

console.log("OK: transaction time helpers");
