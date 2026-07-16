/** Shared money-input helpers: parse, thousand-sep display, Persian words. */

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const p = persianDigits.indexOf(d);
    if (p >= 0) return String(p);
    const a = arabicDigits.indexOf(d);
    if (a >= 0) return String(a);
    return d;
  });
}

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => persianDigits[Number(d)] ?? d);
}

/** Strip separators / spaces and parse a money field to a number (NaN if empty/invalid). */
export function parseAmountInput(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (raw == null) return NaN;
  const cleaned = toEnglishDigits(String(raw))
    .replace(/[,\u066C\u060C\u200E\u200F\s]/g, "")
    .trim();
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Format an amount for an input: Persian digits + thousand separators (e.g. ۱٬۰۰۰٬۰۰۰). */
export function formatAmountInputValue(value: string | number | null | undefined): string {
  if (value === "" || value == null) return "";
  const n = typeof value === "number" ? value : parseAmountInput(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(Math.abs(n));
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(rounded);
}

const ONES = [
  "",
  "یک",
  "دو",
  "سه",
  "چهار",
  "پنج",
  "شش",
  "هفت",
  "هشت",
  "نه",
  "ده",
  "یازده",
  "دوازده",
  "سیزده",
  "چهارده",
  "پانزده",
  "شانزده",
  "هفده",
  "هجده",
  "نوزده",
];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = [
  "",
  "صد",
  "دویست",
  "سیصد",
  "چهارصد",
  "پانصد",
  "ششصد",
  "هفتصد",
  "هشتصد",
  "نهصد",
];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigitsToWords(n: number): string {
  if (n <= 0) return "";
  if (n < 20) return ONES[n] ?? "";
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o ? `${TENS[t]} و ${ONES[o]}` : (TENS[t] ?? "");
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[h] ?? "";
  if (!rest) return head;
  return `${head} و ${threeDigitsToWords(rest)}`;
}

/** Convert a non-negative integer to Persian words (no currency suffix). */
export function numberToPersianWords(amount: number): string {
  const n = Math.round(Math.abs(amount));
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "صفر";

  const parts: string[] = [];
  let remaining = n;
  let scale = 0;

  while (remaining > 0 && scale < SCALES.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const chunkWords = threeDigitsToWords(chunk);
      const scaleWord = SCALES[scale];
      parts.unshift(scaleWord ? `${chunkWords} ${scaleWord}` : chunkWords);
    }
    remaining = Math.floor(remaining / 1000);
    scale += 1;
  }

  return parts.join(" و ");
}

/** e.g. 1000000 → «یک میلیون تومان» */
export function tomanAmountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return "";
  return `${numberToPersianWords(Math.round(amount))} تومان`;
}
