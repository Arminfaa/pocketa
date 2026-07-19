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

/** Troy ounce grams — for deriving ounce from gram-24k when needed */
const TROY_OUNCE_GRAMS = 31.1034768;

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
  source?: "goldapi" | "navasan";
};

export type CurrencyPayload = {
  usdFreeToman: number;
  usdtToman: number;
  /** Absolute toman change from source (legacy / Navasan raw) */
  usdChange: number;
  usdtChange: number;
  /** Day-over-day % vs previous fetch / previous day */
  usdChangePercent: number;
  usdtChangePercent: number;
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
  /** Tehran calendar date used for today's cache key (YYYY-MM-DD) */
  asOfDate: string;
  /** True when gold and/or currency snapshot is older than today (Tehran) */
  stale?: boolean;
  /** Latest snapshot write time (ISO) across gold/currency */
  lastUpdatedAt?: string;
  errors?: {
    gold?: string;
    currency?: string;
  };
};

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 700
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // eslint-disable-next-line no-console
      console.warn(`[market] ${label} attempt ${i}/${attempts} failed`, err);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, delayMs * i));
      }
    }
  }
  throw lastErr;
}

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

/** Percent change vs previous value, one decimal place. */
function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous == null || !(previous > 0) || !Number.isFinite(current)) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function pctFromAbsoluteChange(change: number, current: number): number {
  if (!Number.isFinite(change) || !(current > 0)) return 0;
  return Math.round((change / current) * 1000) / 10;
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

function timestampToIso(ts: unknown): string {
  const n = Number(ts);
  if (Number.isFinite(n) && n > 0) return new Date(n * 1000).toISOString();
  return new Date().toISOString();
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

  const gram18kUsd = roundUsd(gram18k);
  return {
    ounceUsd: roundUsd(ounce),
    gram18kUsd,
    gram24kUsd: roundUsd(gram24k),
    mesghal18kUsd: roundUsd(gram18k * MESGHAL_GRAMS),
    mesghal24kUsd: roundUsd(gram24k * MESGHAL_GRAMS),
    quarterCoinUsd: quarterCoinUsdFromGram18k(gram18kUsd),
    changePercent: Number.isFinite(Number(raw.chp)) ? Number(raw.chp) : 0,
    sourceUpdatedAt: timestampToIso(raw.timestamp),
    source: "goldapi",
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

  const usdChange = Number.isFinite(Number(usd?.change)) ? Number(usd?.change) : 0;
  const usdtChange = Number.isFinite(Number(usdt?.change)) ? Number(usdt?.change) : 0;

  return {
    usdFreeToman: roundToman(usdFreeToman),
    usdtToman: roundToman(usdtToman),
    usdChange,
    usdtChange,
    usdChangePercent: pctFromAbsoluteChange(usdChange, usdFreeToman),
    usdtChangePercent: pctFromAbsoluteChange(usdtChange, usdtToman),
    sourceUpdatedAt: timestampToIso(usd?.timestamp ?? usdt?.timestamp),
  };
}

/** Build gold USD payload from Navasan (18ayar toman + usd rate). */
function mapNavasanGold(raw: NavasanResponse, usdToman: number): GoldPayload {
  if (!(usdToman > 0)) {
    throw new AppError(502, "نرخ دلار برای تبدیل قیمت طلا نامعتبر است");
  }

  const gram18kToman = parseTomanValue(raw["18ayar"]?.value);
  if (gram18kToman == null || gram18kToman <= 0) {
    throw new AppError(502, "قیمت گرم ۱۸ عیار از نوسان دریافت نشد");
  }

  const gram18kUsd = gram18kToman / usdToman;
  const gram24kUsd = gram18kUsd / 0.75;
  const ounceFromApi = Number(String(raw.usd_xau?.value ?? "").replace(/,/g, ""));
  const ounceUsd =
    Number.isFinite(ounceFromApi) && ounceFromApi > 0
      ? ounceFromApi
      : gram24kUsd * TROY_OUNCE_GRAMS;

  const change = Number(raw["18ayar"]?.change);
  const changePercent = pctFromAbsoluteChange(
    Number.isFinite(change) ? change : 0,
    gram18kToman
  );

  return {
    ounceUsd: roundUsd(ounceUsd),
    gram18kUsd: roundUsd(gram18kUsd),
    gram24kUsd: roundUsd(gram24kUsd),
    mesghal18kUsd: roundUsd(gram18kUsd * MESGHAL_GRAMS),
    mesghal24kUsd: roundUsd(gram24kUsd * MESGHAL_GRAMS),
    quarterCoinUsd: quarterCoinUsdFromGram18k(gram18kUsd),
    changePercent,
    sourceUpdatedAt: timestampToIso(
      raw["18ayar"]?.timestamp ?? raw.usd_xau?.timestamp ?? raw.usd_sell?.timestamp
    ),
    source: "navasan",
  };
}

let navasanMemo: { at: number; raw: NavasanResponse } | null = null;

async function fetchNavasanRaw(): Promise<NavasanResponse> {
  if (navasanMemo && Date.now() - navasanMemo.at < 15_000) {
    return navasanMemo.raw;
  }

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

      if (raw.error || raw.message) {
        lastError = new AppError(502, String(raw.error || raw.message));
        continue;
      }

      navasanMemo = { at: Date.now(), raw };
      return raw;
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

async function fetchGoldFromGoldApi(): Promise<GoldPayload> {
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

/** GoldAPI first; on failure/missing key fall back to Navasan 18ayar. */
async function fetchGoldFromApi(): Promise<GoldPayload> {
  const goldKey = env.GOLD_API_KEY?.trim();
  if (goldKey) {
    try {
      return await withRetry("goldapi", fetchGoldFromGoldApi, 2, 500);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[market] goldapi failed — falling back to navasan gold", err);
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn("[market] GOLD_API_KEY missing — using navasan gold");
  }

  const raw = await withRetry("navasan-gold", fetchNavasanRaw);
  const currency = mapNavasanResponse(raw);
  return mapNavasanGold(raw, currency.usdFreeToman);
}

async function fetchCurrencyFromApi(): Promise<CurrencyPayload> {
  const raw = await withRetry("navasan-currency", fetchNavasanRaw);
  return mapNavasanResponse(raw);
}

async function saveSnapshot(kind: "gold" | "currency", payload: GoldPayload | CurrencyPayload) {
  const { date } = tehranNow();
  const fetchedAt = new Date();
  const existing = await MarketPriceModel.findOne({ kind }).lean();

  let toStore: GoldPayload | CurrencyPayload = payload;

  // Prefer % vs our previous stored snapshot (previous request / previous day).
  if (kind === "gold" && existing?.payload) {
    const prev = existing.payload as GoldPayload;
    const next = payload as GoldPayload;
    const fromPrev = pctChange(next.gram18kUsd, prev.gram18kUsd);
    if (fromPrev != null) {
      toStore = { ...next, changePercent: fromPrev };
    }
  } else if (kind === "currency" && existing?.payload) {
    const prev = existing.payload as CurrencyPayload;
    const next = payload as CurrencyPayload;
    const usdPct = pctChange(next.usdFreeToman, prev.usdFreeToman);
    const usdtPct = pctChange(next.usdtToman, prev.usdtToman);
    toStore = {
      ...next,
      ...(usdPct != null ? { usdChangePercent: usdPct } : {}),
      ...(usdtPct != null ? { usdtChangePercent: usdtPct } : {}),
    };
  }

  await MarketPriceModel.findOneAndUpdate(
    { kind },
    { kind, fetchDate: date, fetchedAt, payload: toStore },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  memoryCache = null;
  return { fetchDate: date, fetchedAt };
}

/**
 * Gold: at most once per Tehran calendar day.
 * Currency: at most once per Tehran calendar day.
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
    console.log(`[market] gold refreshed for ${date} via ${payload.source ?? "unknown"}`);
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

/**
 * Daily refresh: one Navasan pull can feed currency + gold fallback.
 * Still tries GoldAPI first when configured.
 */
export async function refreshMarketPricesDaily(): Promise<void> {
  const { date } = tehranNow();
  const [goldDoc, currencyDoc] = await Promise.all([
    MarketPriceModel.findOne({ kind: "gold" }).lean(),
    MarketPriceModel.findOne({ kind: "currency" }).lean(),
  ]);

  const needGold = !goldDoc || goldDoc.fetchDate !== date;
  const needCurrency = !currencyDoc || currencyDoc.fetchDate !== date;
  if (!needGold && !needCurrency) {
    // eslint-disable-next-line no-console
    console.log(`[cron] market prices already fresh for ${date}`);
    return;
  }

  // Prefetch Navasan once so gold fallback + currency share one request
  if (needCurrency || needGold) {
    try {
      await fetchNavasanRaw();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[cron] navasan prefetch failed", err);
    }
  }

  const results = await Promise.allSettled([
    needGold ? refreshGoldIfNeeded() : Promise.resolve(),
    needCurrency ? refreshCurrencyIfNeeded({ ignoreHourGate: true }) : Promise.resolve(),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      // eslint-disable-next-line no-console
      console.error("[cron] market refresh item failed", r.reason);
    }
  }
}

const MEMORY_TTL_MS = 30_000;
let memoryCache: { at: number; data: MarketPricesResponse } | null = null;

function buildMarketResponse(
  goldDoc: { payload?: unknown; fetchDate: string; fetchedAt: Date } | null,
  currencyDoc: { payload?: unknown; fetchDate: string; fetchedAt: Date } | null,
  errors: { gold?: string; currency?: string } = {},
  asOfDate = tehranNow().date
): MarketPricesResponse {
  const gold = goldDoc?.payload ? (goldDoc.payload as GoldPayload) : null;
  const currency = currencyDoc?.payload
    ? (currencyDoc.payload as CurrencyPayload)
    : null;

  const usd = currency?.usdFreeToman ?? null;
  const toToman = (usdPrice: number): number | null =>
    usd == null ? null : roundToman(usdPrice * usd);

  const quarterCoinUsd =
    gold != null
      ? Number.isFinite(Number(gold.quarterCoinUsd))
        ? Number(gold.quarterCoinUsd)
        : quarterCoinUsdFromGram18k(gold.gram18kUsd)
      : 0;

  const goldStale = Boolean(goldDoc && goldDoc.fetchDate !== asOfDate);
  const currencyStale = Boolean(currencyDoc && currencyDoc.fetchDate !== asOfDate);
  const stale = goldStale || currencyStale || !goldDoc || !currencyDoc;

  const fetchedTimes = [goldDoc?.fetchedAt, currencyDoc?.fetchedAt]
    .filter(Boolean)
    .map((d) => new Date(d as Date).getTime())
    .filter((n) => Number.isFinite(n));
  const lastUpdatedAt =
    fetchedTimes.length > 0
      ? new Date(Math.max(...fetchedTimes)).toISOString()
      : undefined;

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
          usdChangePercent:
            Number.isFinite(Number(currency.usdChangePercent))
              ? Number(currency.usdChangePercent)
              : pctFromAbsoluteChange(Number(currency.usdChange) || 0, currency.usdFreeToman),
          usdtChangePercent:
            Number.isFinite(Number(currency.usdtChangePercent))
              ? Number(currency.usdtChangePercent)
              : pctFromAbsoluteChange(Number(currency.usdtChange) || 0, currency.usdtToman),
          fetchDate: currencyDoc!.fetchDate,
          fetchedAt: new Date(currencyDoc!.fetchedAt).toISOString(),
        }
      : null,
    asOfDate,
    ...(lastUpdatedAt ? { lastUpdatedAt } : {}),
    ...(stale ? { stale: true } : {}),
    ...(Object.keys(errors).length ? { errors } : {}),
  };
}

/**
 * Return Mongo (or memory) snapshots. If today's Tehran snapshot is missing,
 * await a refresh (with retries) so the client does not stay stuck on yesterday.
 */
export async function getMarketPrices(): Promise<MarketPricesResponse> {
  if (memoryCache && Date.now() - memoryCache.at < MEMORY_TTL_MS) {
    if (memoryCache.data.asOfDate === tehranNow().date && !memoryCache.data.stale) {
      return memoryCache.data;
    }
    memoryCache = null;
  }

  const { date } = tehranNow();
  let [goldDoc, currencyDoc] = await Promise.all([
    MarketPriceModel.findOne({ kind: "gold" }).lean(),
    MarketPriceModel.findOne({ kind: "currency" }).lean(),
  ]);

  const needGold = !goldDoc || goldDoc.fetchDate !== date;
  const needCurrency = !currencyDoc || currencyDoc.fetchDate !== date;
  const errors: { gold?: string; currency?: string } = {};

  if (needGold || needCurrency) {
    // Prefetch Navasan once for currency + gold fallback
    try {
      await fetchNavasanRaw();
    } catch {
      // individual refresh paths will surface errors
    }

    const [goldResult, currencyResult] = await Promise.allSettled([
      needGold ? refreshGoldIfNeeded() : Promise.resolve(),
      needCurrency ? refreshCurrencyIfNeeded() : Promise.resolve(),
    ]);

    if (needGold && goldResult.status === "rejected") {
      errors.gold = errorMessage(goldResult.reason);
    }
    if (needCurrency && currencyResult.status === "rejected") {
      errors.currency = errorMessage(currencyResult.reason);
    }

    [goldDoc, currencyDoc] = await Promise.all([
      MarketPriceModel.findOne({ kind: "gold" }).lean(),
      MarketPriceModel.findOne({ kind: "currency" }).lean(),
    ]);

    if (needGold && goldDoc && goldDoc.fetchDate !== date && !errors.gold) {
      errors.gold = "به‌روزرسانی قیمت طلا برای امروز ناموفق بود";
    }
    if (needCurrency && currencyDoc && currencyDoc.fetchDate !== date && !errors.currency) {
      errors.currency = "به‌روزرسانی قیمت ارز برای امروز ناموفق بود";
    }
  }

  if (!goldDoc && !currencyDoc) {
    throw new AppError(
      503,
      errors.gold ||
        errors.currency ||
        "قیمت طلا و ارز هنوز در دسترس نیست — کلیدها و لاگ Render را بررسی کنید"
    );
  }

  const data = buildMarketResponse(goldDoc, currencyDoc, errors, date);
  memoryCache = { at: Date.now(), data };
  return data;
}
