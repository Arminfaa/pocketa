import axios, { type AxiosError } from "axios";
import { env } from "../config/env";
import type {
  ExchangeRateApiResponse,
  GoldApiPriceResponse,
  GoldPrices,
} from "../types/gold-price";
import { calculateGoldPrices } from "../utils/goldPriceCalculations";
import { withRetry } from "../utils/httpRetry";
import { AppError } from "../utils/AppError";

const GOLD_API_URL = "https://api.gold-api.com/price/XAU";
const CACHE_TTL_MS = 60_000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

let goldOunceUsdCache: CacheEntry<number> | null = null;
let usdToIrrCache: CacheEntry<number> | null = null;

function readCache<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) return null;
  return entry.value;
}

function writeCache<T>(value: T): CacheEntry<T> {
  return { value, expiresAt: Date.now() + CACHE_TTL_MS };
}

function extractAxiosMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ message?: string }>;
    return ax.response?.data?.message ?? ax.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

async function fetchGoldOunceUsd(): Promise<number> {
  const cached = readCache(goldOunceUsdCache);
  if (cached != null) return cached;

  const price = await withRetry(async () => {
    const { data } = await axios.get<GoldApiPriceResponse>(GOLD_API_URL, {
      timeout: 12_000,
      headers: { Accept: "application/json" },
    });

    if (!Number.isFinite(data?.price) || data.price <= 0) {
      throw new Error("Gold API returned an invalid price");
    }

    return data.price;
  });

  goldOunceUsdCache = writeCache(price);
  return price;
}

async function fetchUsdToIrr(): Promise<number> {
  const cached = readCache(usdToIrrCache);
  if (cached != null) return cached;

  const apiKey = env.EXCHANGE_RATE_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "کلید ExchangeRate-API تنظیم نشده است");
  }

  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

  const rate = await withRetry(async () => {
    const { data } = await axios.get<ExchangeRateApiResponse>(url, {
      timeout: 12_000,
      headers: { Accept: "application/json" },
    });

    if (data.result !== "success") {
      throw new Error(data["error-type"] ?? "ExchangeRate-API request failed");
    }

    const irr = data.conversion_rates?.IRR;
    if (!Number.isFinite(irr) || irr! <= 0) {
      throw new Error("ExchangeRate-API did not return a valid IRR rate");
    }

    return irr!;
  });

  usdToIrrCache = writeCache(rate);
  return rate;
}

/**
 * Fetch live gold & USD/IRR rates, compute gram/mesghal prices (24k & 18k).
 * Each upstream API response is cached for 60 seconds.
 */
export async function getGoldPrices(): Promise<GoldPrices> {
  try {
    const [goldOunceUSD, usdToIRR] = await Promise.all([
      fetchGoldOunceUsd(),
      fetchUsdToIrr(),
    ]);

    return calculateGoldPrices(goldOunceUSD, usdToIRR);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      502,
      `خطا در دریافت قیمت طلا: ${extractAxiosMessage(error, "سرویس در دسترس نیست")}`
    );
  }
}

/** Test helper — clears in-memory API caches. */
export function clearGoldPriceCache(): void {
  goldOunceUsdCache = null;
  usdToIrrCache = null;
}
