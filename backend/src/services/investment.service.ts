import { CategoryModel } from "../models/Category";
import type { MarketPricesResponse } from "./market-prices.service";

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
export type GoldKind = "melted" | "quarter_coin" | "half_coin" | "full_coin";

export const GOLD_KIND_VALUES = [
  "melted",
  "quarter_coin",
  "half_coin",
  "full_coin",
] as const satisfies readonly GoldKind[];

export function resolveGoldKind(
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): GoldKind | null {
  if (assetType !== "gold") return null;
  if (
    goldKind === "quarter_coin" ||
    goldKind === "half_coin" ||
    goldKind === "full_coin"
  ) {
    return goldKind;
  }
  return "melted";
}

export function isCoinGoldKind(kind: GoldKind | string | null | undefined): boolean {
  return kind === "quarter_coin" || kind === "half_coin" || kind === "full_coin";
}

export function goldKindLabel(kind: GoldKind | string | null | undefined): string {
  if (kind === "quarter_coin") return "ربع سکه";
  if (kind === "half_coin") return "نیم سکه";
  if (kind === "full_coin") return "تمام سکه";
  return "طلا (آب شده/پارسیان)";
}

export function formatAssetQuantity(
  qty: number,
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): string {
  const rounded = Math.round(qty * 1000) / 1000;
  if (assetType === "usd") return `${rounded} دلار`;
  if (assetType === "rial") return `${Math.round(qty).toLocaleString("en-US")} تومان`;
  const kind = resolveGoldKind(assetType, goldKind);
  if (isCoinGoldKind(kind)) {
    return `${Math.round(qty).toLocaleString("en-US")} عدد ${goldKindLabel(kind)}`;
  }
  return `${rounded} گرم طلا`;
}

export function assetTypeLabel(
  assetType: InvestmentAssetType | string,
  goldKind?: GoldKind | string | null
): string {
  if (assetType === "usd") return "دلار";
  if (assetType === "rial") return "ریال";
  return goldKindLabel(resolveGoldKind(assetType, goldKind));
}

/** Unit price in toman for asset-linked investments / dues. */
export function unitPriceToman(
  assetType: InvestmentAssetType | string,
  goldKind: GoldKind | string | null | undefined,
  market: MarketPricesResponse
): number | null {
  if (assetType === "rial") return 1;
  if (assetType === "usd") return market.currency?.usdFreeToman ?? null;
  if (assetType === "gold") {
    const kind = resolveGoldKind(assetType, goldKind);
    if (kind === "quarter_coin") return market.gold?.quarterCoinToman ?? null;
    if (kind === "half_coin") return market.gold?.halfCoinToman ?? null;
    if (kind === "full_coin") return market.gold?.fullCoinToman ?? null;
    return market.gold?.gram18kToman ?? null;
  }
  return null;
}
