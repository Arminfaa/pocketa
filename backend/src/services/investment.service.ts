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

export function formatAssetQuantity(qty: number, assetType: "gold" | "usd"): string {
  const rounded = Math.round(qty * 1000) / 1000;
  return assetType === "gold" ? `${rounded} گرم طلا` : `${rounded} دلار`;
}
