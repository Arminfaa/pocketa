import { env } from "../config/env";
import { MarketPriceModel } from "../models/MarketPrice";
import { AppError } from "../utils/AppError";
import { tehranNow } from "../utils/tehranTime";

/** Iranian mesghal weight in grams */
export const MESGHAL_GRAMS = 4.608;

/**
 * ربع سکه (از گرم ۱۸ عیار):
 * (gram18k / 750) * 900 * 2.033
 */
export const QUARTER_COIN_FACTOR = (900 / 750) * 2.033;

/** Refresh free-market dollar / usdt at or after this Tehran hour */
export const CURRENCY_REFRESH_HOUR_TEHRAN = 14;

const GOLD_API_URL = "https://www.goldapi.io/api/XAU/USD";
const NAVASAN_API_URLS = [
  "https://api.navasan.tech/latest/",
  "http://api.navasan.tech/latest/",
];

export type GoldPayload = {
  ounceUsd: number;
  gram18kUsd: number;
  gram24kUsd: number;
  mesghal18kUsd: number;
  mesghal24kUsd: number;
  /** قیمت ربع سکه (USD) — از گرم ۱۸ عیار */
  quarterCoinUsd: number;
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
  gold: (GoldPayload & {
    gram18kToman: number | null;
    gram24kToman: number | null;
    mesghal18kToman: number | null;
    mesghal24kToman: number | null;
    quarterCoinToman: number | null;
    fetchDate: string;
    fetchedAt: string;
  }) | null;
  currency: (CurrencyPayload & {
    fetchDate: string;
    fetchedAt: string;
  }) | null;
  errors?: {
    gold?: string;
    currency?: string;
  };
};

type GoldApiResponse = {
  price?: number;
  chp?: number;
  price_gram_18k?: number;
  price_gram_24k?: number;
  timestamp?: number;
  error?: string;
  message?: string;
};

type NavasanItem = {
  value?: string | number;
  change?: number;
  timestamp?: number;
  date?: string;
};

type NavasanResponse = Record<string, NavasanItem> & {
  error?: string;
  message?: string;
};

function roundUsd(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundToman(n: number): number {
  return Math.round(n);
}

/** Derive quarter-coin USD from 18k gram price (works for cached payloads without the field). */
export function quarterCoinUsdFromGram18k(gram18kUsd: number): number {
  return roundUsd(gram18kUsd * QUARTER_COIN_FACTOR);
}

function parseTomanValue(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "خطای ناشناخته";
}

function mapGoldResponse(raw: GoldApiResponse): GoldPayload {
  if (raw.error || (raw.message && raw.price == null)) {
    throw new AppError(502, String(raw.error || raw.message || "خطای سرویس طلا"));
  }

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

  const gram18kUsd = roundUsd(gram18k);
  return {
    ounceUsd: roundUsd(ounce),
    gram18kUsd,
    gram24kUsd: roundUsd(gram24k),
    mesghal18kUsd: roundUsd(gram18k * MESGHAL_GRAMS),
    mesghal24kUsd: roundUsd(gram24k * MESGHAL_GRAMS),
    quarterCoinUsd: quarterCoinUsdFromGram18k(gram18kUsd),
    changePercent: Number.isFinite(Number(raw.chp)) ? Number(raw.chp) : 0,
    sourceUpdatedAt,
  };
}

function mapNavasanResponse(raw: NavasanResponse): CurrencyPayload {
  if (raw.error || raw.message) {
    throw new AppError(502, String(raw.error || raw.message));
  }

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
    throw new AppError(503, "سرویس قیمت طلا پیکربندی نشده است (GOLD_API_KEY)");
  }

  let response: Response;
  try {
    response = await fetch(GOLD_API_URL, {
      method: "GET",
      headers: {
        "x-access-token": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[market] gold fetch network error", err);
    throw new AppError(502, "خطا در ارتباط با سرویس قیمت طلا");
  }

  const text = await response.text();
  let raw: GoldApiResponse;
  try {
    raw = JSON.parse(text) as GoldApiResponse;
  } catch {
    // eslint-disable-next-line no-console
    console.error("[market] gold non-JSON response", response.status, text.slice(0, 300));
    throw new AppError(502, "پاسخ نامعتبر از سرویس قیمت طلا");
  }

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error("[market] gold HTTP error", response.status, raw);
    throw new AppError(
      502,
      String(raw.error || raw.message || `سرویس طلا HTTP ${response.status}`)
    );
  }

  return mapGoldResponse(raw);
}

async function fetchCurrencyFromApi(): Promise<CurrencyPayload> {
  const apiKey = env.NAVASAN_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "سرویس قیمت ارز پیکربندی نشده است (NAVASAN_API_KEY)");
  }

  let lastError: unknown;

  for (const base of NAVASAN_API_URLS) {
    const url = `${base}?api_key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });

      const text = await response.text();
      let raw: NavasanResponse;
      try {
        raw = JSON.parse(text) as NavasanResponse;
      } catch {
        // eslint-disable-next-line no-console
        console.error("[market] navasan non-JSON", base, response.status, text.slice(0, 300));
        lastError = new AppError(502, "پاسخ نامعتبر از سرویس قیمت ارز");
        continue;
      }

      if (!response.ok) {
        // eslint-disable-next-line no-console
        console.error("[market] navasan HTTP error", base, response.status, raw);
        lastError = new AppError(
          502,
          String(raw.error || raw.message || `سرویس ارز HTTP ${response.status}`)
        );
        continue;
      }

      return mapNavasanResponse(raw);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[market] navasan fetch failed", base, err);
      lastError = err;
    }
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError(502, "خطا در ارتباط با سرویس قیمت ارز");
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
 * Currency: at most once per Tehran calendar day (same as gold for now).
 * Hour gate (14:00) temporarily disabled so first load can bootstrap immediately.
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
  _opts: { ignoreHourGate?: boolean } = {}
): Promise<void> {
  const { date } = tehranNow();
  const existing = await MarketPriceModel.findOne({ kind: "currency" }).lean();

  if (existing && existing.fetchDate === date) {
    return;
  }

  // TEMP: hour gate disabled — fetch on first need of the day so dashboard shows USD/USDT.
  // Re-enable later for quota control:
  // const { hour } = tehranNow();
  // if (!opts.ignoreHourGate && existing && hour < CURRENCY_REFRESH_HOUR_TEHRAN) {
  //   return;
  // }

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
  const results = await Promise.allSettled([
    refreshGoldIfNeeded(),
    refreshCurrencyIfNeeded({ ignoreHourGate: true }),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      // eslint-disable-next-line no-console
      console.error("[cron] market refresh item failed", r.reason);
    }
  }
}

export async function getMarketPrices(): Promise<MarketPricesResponse> {
  const errors: { gold?: string; currency?: string } = {};

  // Independent refreshes — one failing source must not block the other
  const [goldResult, currencyResult] = await Promise.allSettled([
    refreshGoldIfNeeded(),
    refreshCurrencyIfNeeded(),
  ]);

  if (goldResult.status === "rejected") {
    errors.gold = errorMessage(goldResult.reason);
    // eslint-disable-next-line no-console
    console.error("[market] gold refresh rejected", goldResult.reason);
  }
  if (currencyResult.status === "rejected") {
    errors.currency = errorMessage(currencyResult.reason);
    // eslint-disable-next-line no-console
    console.error("[market] currency refresh rejected", currencyResult.reason);
  }

  const [goldDoc, currencyDoc] = await Promise.all([
    MarketPriceModel.findOne({ kind: "gold" }).lean(),
    MarketPriceModel.findOne({ kind: "currency" }).lean(),
  ]);

  const gold = goldDoc?.payload ? (goldDoc.payload as GoldPayload) : null;
  const currency = currencyDoc?.payload
    ? (currencyDoc.payload as CurrencyPayload)
    : null;

  if (!gold && !currency) {
    throw new AppError(
      503,
      errors.gold ||
        errors.currency ||
        "قیمت طلا و ارز هنوز در دسترس نیست — کلیدها و لاگ Render را بررسی کنید"
    );
  }

  const usd = currency?.usdFreeToman ?? null;
  const toToman = (usdPrice: number): number | null =>
    usd == null ? null : roundToman(usdPrice * usd);

  const quarterCoinUsd =
    gold != null
      ? Number.isFinite(Number(gold.quarterCoinUsd))
        ? Number(gold.quarterCoinUsd)
        : quarterCoinUsdFromGram18k(gold.gram18kUsd)
      : 0;

  return {
    gold: gold
      ? {
          ...gold,
          quarterCoinUsd,
          gram18kToman: toToman(gold.gram18kUsd),
          gram24kToman: toToman(gold.gram24kUsd),
          mesghal18kToman: toToman(gold.mesghal18kUsd),
          mesghal24kToman: toToman(gold.mesghal24kUsd),
          quarterCoinToman: toToman(quarterCoinUsd),
          fetchDate: goldDoc!.fetchDate,
          fetchedAt: new Date(goldDoc!.fetchedAt).toISOString(),
        }
      : null,
    currency: currency
      ? {
          ...currency,
          fetchDate: currencyDoc!.fetchDate,
          fetchedAt: new Date(currencyDoc!.fetchedAt).toISOString(),
        }
      : null,
    ...(Object.keys(errors).length ? { errors } : {}),
  };
}
