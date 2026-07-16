const englishToPersian: Record<string, string> = {
  "0": "۰",
  "1": "۱",
  "2": "۲",
  "3": "۳",
  "4": "۴",
  "5": "۵",
  "6": "۶",
  "7": "۷",
  "8": "۸",
  "9": "۹",
};

export function toPersianDigits(input: string): string {
  return input.replace(/[0-9]/g, (d) => englishToPersian[d] ?? d);
}

export function formatToman(amount: number): string {
  return `${new Intl.NumberFormat("fa-IR").format(Math.round(amount))} تومان`;
}

export function formatJalaliDate(jalaliDate: string): string {
  // Keep YYYY/MM/DD format but convert digits for display.
  return jalaliDate
    .split("/")
    .map((p) => toPersianDigits(p))
    .join("/");
}

