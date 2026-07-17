import { CategoryModel } from "../models/Category";

/** Ensure the default "سرمایه گذاری" income category exists for the user. */
export async function ensureInvestmentIncomeCategory(userId: string) {
  const existing = await CategoryModel.findOne({
    userId,
    type: "income",
    name: "سرمایه گذاری",
  });
  if (existing) return existing;

  return CategoryModel.create({
    userId,
    name: "سرمایه گذاری",
    type: "income",
    icon: "TrendingUp",
    color: "#60a5fa",
  });
}

export function computeProfitAssetQuantity(input: {
  quantity: number;
  hasProfit: boolean;
  profitMode?: "fixed" | "percent" | null;
  profitValue?: number | null;
}): number {
  if (!input.hasProfit || input.profitValue == null || input.profitValue <= 0) return 0;
  if (input.profitMode === "fixed") return input.profitValue;
  if (input.profitMode === "percent") {
    return (input.quantity * input.profitValue) / 100;
  }
  return 0;
}

export type InvestmentAssetType = "gold" | "usd" | "rial";
export type GoldKind = "melted" | "quarter_coin";

export function resolveGoldKind(
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): GoldKind | null {
  if (assetType !== "gold") return null;
  return goldKind === "quarter_coin" ? "quarter_coin" : "melted";
}

export function formatAssetQuantity(
  qty: number,
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): string {
  const rounded = Math.round(qty * 1000) / 1000;
  if (assetType === "usd") return `${rounded} دلار`;
  if (assetType === "rial") return `${Math.round(qty).toLocaleString("en-US")} تومان`;
  if (resolveGoldKind(assetType, goldKind) === "quarter_coin") {
    return `${Math.round(qty).toLocaleString("en-US")} عدد ربع سکه`;
  }
  return `${rounded} گرم طلا`;
}

export function assetTypeLabel(
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): string {
  if (assetType === "usd") return "دلار";
  if (assetType === "rial") return "ریال";
  if (resolveGoldKind(assetType, goldKind) === "quarter_coin") return "ربع سکه";
  return "طلا (آب شده/پارسیان)";
}
