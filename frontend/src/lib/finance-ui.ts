export const CATEGORY_COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#a78bfa",
];

export const CATEGORY_ICONS = [
  "Utensils",
  "Bus",
  "ShoppingCart",
  "Receipt",
  "Sparkles",
  "HeartPulse",
  "BookOpen",
  "BriefcaseBusiness",
  "Wrench",
  "TrendingUp",
  "Gift",
  "Home",
  "Wifi",
  "Car",
  "Coffee",
  "Landmark",
] as const;

export function getJalaliMonthYear(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "numeric",
    }).formatToParts(new Date());
    const map = "۰۱۲۳۴۵۶۷۸۹";
    const toEn = (s: string) => s.replace(/[۰-۹]/g, (d) => String(map.indexOf(d)));
    const year = Number(toEn(parts.find((p) => p.type === "year")?.value ?? "1405"));
    const month = Number(toEn(parts.find((p) => p.type === "month")?.value ?? "1"));
    return { year, month };
  } catch {
    return { year: 1405, month: 1 };
  }
}

export const MONTH_LABELS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
