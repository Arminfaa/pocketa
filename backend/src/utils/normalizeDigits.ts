const persianToEnglishDigits: Record<string, string> = {
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

export function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (ch) => persianToEnglishDigits[ch] ?? ch);
}

export function normalizeJalaliDate(input: string): string {
  // Expected: YYYY/MM/DD (Jalali)
  const normalized = toEnglishDigits(input).trim();
  const parts = normalized.split("/");
  if (parts.length !== 3) return normalized;
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const yy = y.padStart(4, "0").slice(-4);
  const mm = m.padStart(2, "0").slice(-2);
  const dd = d.padStart(2, "0").slice(-2);
  return `${yy}/${mm}/${dd}`;
}

export function extractJalaliMonthYear(dateJalali: string): { year: number; month: number } {
  const normalized = normalizeJalaliDate(dateJalali);
  const [y, m] = normalized.split("/");
  return { year: Number(y), month: Number(m) };
}

