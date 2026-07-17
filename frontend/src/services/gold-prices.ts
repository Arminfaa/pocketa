"use client";

import api from "@/services/api";
import type { GoldPrices } from "@/types/gold-price";

export async function fetchGoldPrices(): Promise<GoldPrices> {
  const res = await api.get("/api/gold-prices");
  return res.data.data as GoldPrices;
}
