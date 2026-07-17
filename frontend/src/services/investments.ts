"use client";

import api from "@/services/api";

export type InvestmentAssetType = "gold" | "usd";
export type ProfitMode = "fixed" | "percent";
export type ProfitFrequency = "daily" | "monthly" | "yearly";

export type Investment = {
  id: string;
  title: string;
  assetType: InvestmentAssetType;
  quantity: number;
  purchasePricePerUnit: number;
  purchaseDate: string;
  hasProfit: boolean;
  profitMode: ProfitMode | null;
  profitValue: number | null;
  profitFrequency: ProfitFrequency | null;
  profitNextDate: string;
  profitEndDate: string;
  profitAssetQuantity: number;
  profitTomanPerPeriod: number | null;
  recurringId: string | null;
  notes: string;
  active: boolean;
  costBasis: number;
  currentUnitPrice: number | null;
  currentValue: number | null;
  unrealizedPnl: number | null;
};

export type InvestmentsSummary = {
  count: number;
  totalCost: number;
  totalValue: number | null;
  totalUnrealizedPnl: number | null;
  goldQuantity: number;
  usdQuantity: number;
};

export type CreateInvestmentPayload = {
  title: string;
  assetType: InvestmentAssetType;
  quantity: number;
  purchasePricePerUnit: number;
  purchaseDate: string;
  hasProfit: boolean;
  profitMode?: ProfitMode | null;
  profitValue?: number | null;
  profitFrequency?: ProfitFrequency | null;
  profitNextDate?: string | null;
  profitEndDate?: string | null;
  notes?: string | null;
};

export async function fetchInvestments(): Promise<{
  items: Investment[];
  summary: InvestmentsSummary;
}> {
  const res = await api.get("/api/investments");
  return res.data.data;
}

export async function createInvestment(payload: CreateInvestmentPayload): Promise<void> {
  await api.post("/api/investments", payload);
}

export async function deleteInvestment(id: string): Promise<void> {
  await api.delete(`/api/investments/${id}`);
}
