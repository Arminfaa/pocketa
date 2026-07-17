import { env } from "../config/env";
import { MarketPriceModel } from "../models/MarketPrice";
import { AppError } from "../utils/AppError";
import { tehranNow } from "../utils/tehranTime";

/** Iranian mesghal weight in grams */
export const MESGHAL_GRAMS = 4.608;

/** Refresh free-market dollar / usdt at or after this Tehran hour */
export const CURRENCY_REFRESH_HOUR_TEHRAN = 14;

const GOLD_API_URL = "https://www.goldapi.io/api/XAU/USD";
const NAVASAN_API_URL = "http://api.navasan.tech/latest/";

export type GoldPayload = {
  ounceUsd: number;
  gram18kUsd: number;
  gram24kUsd: number;
  mesghal18kUsd: number;
  mesghal24kUsd: number;
  changePercent: number;
  sourceUpdatedAt: string;
};

export type CurrencyPayload = {
  usdFreeToman: number;
  usdtToman: number;
  usdChange: number;
  usdtChange: number;
  sourceUpdatedAt: string;
};

export type MarketPricesResponse = {
  gold: GoldPayload & {
    gram18kToman: number | null;
    gram24kToman: number | null;
    mesghal18kToman: number | null;
    mesghal24kToman: number | null;
    fetchDate: string;
    fetchedAt: string;
  };
  currency: CurrencyPayload & {
    fetchDate: string;
    fetchedAt: string;
  } | null;
};

type GoldApiResponse = {
  price?: number;
  chp?: number;
  price_gram_18k?: number;
  price_gram_24k?: number;
  timestamp?: number;
};

type NavasanItem = {
  value?: string | number;
  change?: number;
  timestamp?: number;
  date?: string;
};

type NavasanResponse = Record<string, NavasanItem>;

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundToman(n: number): number {
  return Math.round(n);
}

function parseTomanValue(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function mapGoldResponse(raw: GoldApiResponse): GoldPayload {
  const gram18k = Number(raw.price_gram_18k);
  const gram24k = Number(raw.price_gram_24k);
  const ounce = Number(raw.price);

  if (!Number.isFinite(gram18k) || !Number.isFinite(gram24k) || !Number.isFinite(ounce)) {
    throw new AppError(502, "پاسخ نامعتبر از سرویس قیمت طلا");
  }

  const sourceUpdatedAt =
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
    sourceUpdatedAt,
  };
}

function mapNavasanResponse(raw: NavasanResponse): CurrencyPayload {
  const usd = raw.usd_sell;
  const usdt = raw.usdt ?? raw.usd_usdt;

  const usdFreeToman = parseTomanValue(usd?.value);
  const usdtToman = parseTomanValue(usdt?.value);

  if (usdFreeToman == null || usdtToman == null) {
    throw new AppError(502, "پاسخ نامعتبر از سرویس قیمت ارز");
  }

  const ts = Number(usd?.timestamp ?? usdt?.timestamp);
  const sourceUpdatedAt =
    Number.isFinite(ts) && ts > 0
      ? new Date(ts * 1000).toISOString()
      : new Date().toISOString();

  return {
    usdFreeToman: roundToman(usdFreeToman),
    usdtToman: roundToman(usdtToman),
    usdChange: Number.isFinite(Number(usd?.change)) ? Number(usd?.change) : 0,
    usdtChange: Number.isFinite(Number(usdt?.change)) ? Number(usdt?.change) : 0,
    sourceUpdatedAt,
  };
}

async function fetchGoldFromApi(): Promise<GoldPayload> {
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
    throw new AppError(502, "خطا در ارتباط با سرویس قیمت طلا");
  }

  if (!response.ok) {
    throw new AppError(502, "سرویس قیمت طلا در دسترس نیست");
  }

  const raw = (await response.json()) as GoldApiResponse;
  return mapGoldResponse(raw);
}

async function fetchCurrencyFromApi(): Promise<CurrencyPayload> {
  const apiKey = env.NAVASAN_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "سرویس قیمت ارز پیکربندی نشده است");
  }

  const url = `${NAVASAN_API_URL}?api_key=${encodeURIComponent(apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AppError(502, "خطا در ارتباط با سرویس قیمت ارز");
  }

  if (!response.ok) {
    throw new AppError(502, "سرویس قیمت ارز در دسترس نیست");
  }

  const raw = (await response.json()) as NavasanResponse;
  return mapNavasanResponse(raw);
}

async function saveSnapshot(kind: "gold" | "currency", payload: GoldPayload | CurrencyPayload) {
  const { date } = tehranNow();
  const fetchedAt = new Date();
  await MarketPriceModel.findOneAndUpdate(
    { kind },
    { kind, fetchDate: date, fetchedAt, payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return { fetchDate: date, fetchedAt };
}

/**
 * Gold: at most once per Tehran calendar day.
 * Currency: at most once per day; preferred at/after 14:00 Tehran.
 * If never stored, fetch immediately (bootstrap).
 */
export async function refreshGoldIfNeeded(): Promise<void> {
  const { date } = tehranNow();
  const existing = await MarketPriceModel.findOne({ kind: "gold" }).lean();

  if (existing && existing.fetchDate === date) {
    return;
  }

  try {
    const payload = await fetchGoldFromApi();
    await saveSnapshot("gold", payload);
    // eslint-disable-next-line no-console
    console.log(`[market] gold refreshed for ${date}`);
  } catch (err) {
    if (existing) {
      // eslint-disable-next-line no-console
      console.warn("[market] gold refresh failed; keeping previous snapshot", err);
      return;
    }
    throw err;
  }
}

export async function refreshCurrencyIfNeeded(
  opts: { ignoreHourGate?: boolean } = {}
): Promise<void> {
  const { date, hour } = tehranNow();
  const existing = await MarketPriceModel.findOne({ kind: "currency" }).lean();

  if (existing && existing.fetchDate === date) {
    return;
  }

  // Keep yesterday's rate until the scheduled 14:00 window (unless cron)
  if (
    !opts.ignoreHourGate &&
    existing &&
    hour < CURRENCY_REFRESH_HOUR_TEHRAN
  ) {
    return;
  }

  try {
    const payload = await fetchCurrencyFromApi();
    await saveSnapshot("currency", payload);
    // eslint-disable-next-line no-console
    console.log(`[market] currency refreshed for ${date}`);
  } catch (err) {
    if (existing) {
      // eslint-disable-next-line no-console
      console.warn("[market] currency refresh failed; keeping previous snapshot", err);
      return;
    }
    throw err;
  }
}

/** Cron 14:00 Tehran: refresh both if not yet stored for today. */
export async function refreshMarketPricesDaily(): Promise<void> {
  await Promise.all([
    refreshGoldIfNeeded(),
    refreshCurrencyIfNeeded({ ignoreHourGate: true }),
  ]);
}

export async function getMarketPrices(): Promise<MarketPricesResponse> {
  await Promise.all([
    refreshGoldIfNeeded(),
    refreshCurrencyIfNeeded(),
  ]);

  const [goldDoc, currencyDoc] = await Promise.all([
    MarketPriceModel.findOne({ kind: "gold" }).lean(),
    MarketPriceModel.findOne({ kind: "currency" }).lean(),
  ]);

  if (!goldDoc?.payload) {
    throw new AppError(503, "قیمت طلا هنوز در دسترس نیست");
  }

  const gold = goldDoc.payload as GoldPayload;
  const currency = currencyDoc?.payload
    ? (currencyDoc.payload as CurrencyPayload)
    : null;

  const usd = currency?.usdFreeToman ?? null;
  const toToman = (usdPrice: number): number | null =>
    usd == null ? null : roundToman(usdPrice * usd);

  return {
    gold: {
      ...gold,
      gram18kToman: toToman(gold.gram18kUsd),
      gram24kToman: toToman(gold.gram24kUsd),
      mesghal18kToman: toToman(gold.mesghal18kUsd),
      mesghal24kToman: toToman(gold.mesghal24kUsd),
      fetchDate: goldDoc.fetchDate,
      fetchedAt: new Date(goldDoc.fetchedAt).toISOString(),
    },
    currency: currency
      ? {
          ...currency,
          fetchDate: currencyDoc!.fetchDate,
          fetchedAt: new Date(currencyDoc!.fetchedAt).toISOString(),
        }
      : null,
  };
}

