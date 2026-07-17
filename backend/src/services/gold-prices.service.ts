import { env } from "../config/env";
import { AppError } from "../utils/AppError";

/** Iranian mesghal weight in grams */
export const MESGHAL_GRAMS = 4.608;

const GOLD_API_URL = "https://www.goldapi.io/api/XAU/USD";
const CACHE_TTL_MS = 60_000;

export type GoldPrices = {
  ounceUsd: number;
  gram18kUsd: number;
  gram24kUsd: number;
  mesghal18kUsd: number;
  mesghal24kUsd: number;
  changePercent: number;
  updatedAt: string;
  cached: boolean;
};

type GoldApiResponse = {
  price?: number;
  chp?: number;
  price_gram_18k?: number;
  price_gram_24k?: number;
  timestamp?: number;
};

type CacheEntry = {
  expiresAt: number;
  data: Omit<GoldPrices, "cached">;
};

let cache: CacheEntry | null = null;

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapResponse(raw: GoldApiResponse): Omit<GoldPrices, "cached"> {
  const gram18k = Number(raw.price_gram_18k);
  const gram24k = Number(raw.price_gram_24k);
  const ounce = Number(raw.price);

  if (!Number.isFinite(gram18k) || !Number.isFinite(gram24k) || !Number.isFinite(ounce)) {
    throw new AppError(502, "پاسخ نامعتبر از سرویس قیمت طلا");
  }

  const updatedAt =
    typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
      ? new Date(raw.timestamp * 1000).toISOString()
      : new Date().toISOString();

  return {
    ounceUsd: roundUsd(ounce),
    gram18kUsd: roundUsd(gram18k),
    gram24kUsd: roundUsd(gram24k),
    mesghal18kUsd: roundUsd(gram18k * MESGHAL_GRAMS),
    mesghal24kUsd: roundUsd(gram24k * MESGHAL_GRAMS),
    changePercent: Number.isFinite(Number(raw.chp)) ? Number(raw.chp) : 0,
    updatedAt,
  };
}

export async function getGoldPrices(): Promise<GoldPrices> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return { ...cache.data, cached: true };
  }

  const apiKey = env.GOLD_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "سرویس قیمت طلا پیکربندی نشده است");
  }

  let response: Response;
  try {
    response = await fetch(GOLD_API_URL, {
      method: "GET",
      headers: {
        "x-access-token": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    if (cache) return { ...cache.data, cached: true };
    throw new AppError(502, "خطا در ارتباط با سرویس قیمت طلا");
  }

  if (!response.ok) {
    if (cache) return { ...cache.data, cached: true };
    throw new AppError(502, "سرویس قیمت طلا در دسترس نیست");
  }

  const raw = (await response.json()) as GoldApiResponse;
  const data = mapResponse(raw);

  cache = {
    expiresAt: now + CACHE_TTL_MS,
    data,
  };

  return { ...data, cached: false };
}
