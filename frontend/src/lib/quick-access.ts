export type QuickAccessKey =
  | "review"
  | "recurring"
  | "investments"
  | "budgets"
  | "goals"
  | "accounts"
  | "categories"
  | "imports"
  | "settings"
  | "transactions"
  | "reports"
  | "new-transaction";

export type QuickAccessDef = {
  key: QuickAccessKey;
  href: string;
  label: string;
};

/** All pickable shortcuts for dashboard quick access. */
export const QUICK_ACCESS_CATALOG: QuickAccessDef[] = [
  { key: "review", href: "/review", label: "نام‌گذاری" },
  { key: "recurring", href: "/recurring", label: "سررسید‌ها" },
  { key: "investments", href: "/investments", label: "سرمایه‌گذاری" },
  { key: "budgets", href: "/budgets", label: "بودجه" },
  { key: "goals", href: "/goals", label: "اهداف" },
  { key: "accounts", href: "/accounts", label: "حساب‌ها" },
  { key: "categories", href: "/categories", label: "دسته‌بندی‌ها" },
  { key: "imports", href: "/imports/bank-sms", label: "ایمپورت" },
  { key: "settings", href: "/settings", label: "تنظیمات" },
  { key: "transactions", href: "/transactions", label: "تراکنش‌ها" },
  { key: "reports", href: "/reports", label: "گزارش‌ها" },
  { key: "new-transaction", href: "/transactions?new=1", label: "تراکنش جدید" },
];

/** Default visible shortcuts (no import / transactions / reports). */
export const DEFAULT_QUICK_ACCESS_KEYS: QuickAccessKey[] = [
  "review",
  "recurring",
  "investments",
  "budgets",
];

export const QUICK_ACCESS_MAX = 7;

export function sanitizeQuickAccessKeys(keys: unknown): QuickAccessKey[] {
  const allowed = new Set(QUICK_ACCESS_CATALOG.map((c) => c.key));
  if (!Array.isArray(keys)) return [...DEFAULT_QUICK_ACCESS_KEYS];
  const out: QuickAccessKey[] = [];
  for (const k of keys) {
    if (typeof k !== "string" || !allowed.has(k as QuickAccessKey)) continue;
    if (out.includes(k as QuickAccessKey)) continue;
    out.push(k as QuickAccessKey);
    if (out.length >= QUICK_ACCESS_MAX) break;
  }
  return out.length > 0 ? out : [...DEFAULT_QUICK_ACCESS_KEYS];
}
