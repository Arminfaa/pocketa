const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

function toEnglishDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
}

/** Today's Jalali date as YYYY/MM/DD (English digits). */
export function getTodayJalali(): string {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = toEnglishDigits(parts.find((p) => p.type === "year")?.value ?? "");
    const month = toEnglishDigits(parts.find((p) => p.type === "month")?.value ?? "").padStart(
      2,
      "0"
    );
    const day = toEnglishDigits(parts.find((p) => p.type === "day")?.value ?? "").padStart(2, "0");
    if (year && month && day) return `${year}/${month}/${day}`;
  } catch {
    // fallback below
  }
  return "1405/01/01";
}

export function categoryName(
  categoryId: { name?: string } | string | null | undefined
): string {
  if (!categoryId) return "—";
  if (typeof categoryId === "string") return "—";
  return categoryId.name ?? "—";
}

export function accountName(accountId: { name?: string } | string | null | undefined): string {
  if (!accountId) return "—";
  if (typeof accountId === "string") return "—";
  return accountId.name ?? "—";
}

export function categoryIdValue(
  categoryId: { _id?: string } | string | null | undefined
): string {
  if (!categoryId) return "";
  if (typeof categoryId === "string") return categoryId;
  return categoryId._id ?? "";
}

export function accountIdValue(accountId: { _id?: string } | string | null | undefined): string {
  if (!accountId) return "";
  if (typeof accountId === "string") return accountId;
  return accountId._id ?? "";
}
