import type { GoldPrices } from "../types/gold-price";

/** Physical & karat constants used across gold price formulas. */
export const GOLD_PRICE_CONSTANTS = {
  GRAMS_PER_TROY_OUNCE: 31.1034768,
  GRAMS_PER_MESGHAL: 4.608,
  KARAT_24_FACTOR: 1,
  KARAT_18_FACTOR: 0.75,
  RIALS_PER_TOMAN: 10,
} as const;

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

/**
 * Pure calculation layer — no I/O.
 * All formulas from product spec (ounce → gram → rial → toman → mesghal).
 */
export function calculateGoldPrices(goldOunceUSD: number, usdToIRR: number): GoldPrices {
  assertPositive(goldOunceUSD, "goldOunceUSD");
  assertPositive(usdToIRR, "usdToIRR");

  const { GRAMS_PER_TROY_OUNCE, GRAMS_PER_MESGHAL, KARAT_18_FACTOR, RIALS_PER_TOMAN } =
    GOLD_PRICE_CONSTANTS;

  const gram24Usd = goldOunceUSD / GRAMS_PER_TROY_OUNCE;
  const gram24IRR = gram24Usd * usdToIRR;
  const gram18IRR = gram24IRR * KARAT_18_FACTOR;

  const gram24Toman = gram24IRR / RIALS_PER_TOMAN;
  const gram18Toman = gram18IRR / RIALS_PER_TOMAN;

  const mesghal24Toman = gram24Toman * GRAMS_PER_MESGHAL;
  const mesghal18Toman = gram18Toman * GRAMS_PER_MESGHAL;

  return {
    goldOunceUSD,
    usdToIRR,
    gram24Usd,
    gram24IRR,
    gram24Toman,
    gram18IRR,
    gram18Toman,
    mesghal24Toman,
    mesghal18Toman,
  };
}
