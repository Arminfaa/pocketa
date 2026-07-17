/** Final computed gold price snapshot. */
export type GoldPrices = {
  goldOunceUSD: number;
  usdToIRR: number;
  gram24Usd: number;
  gram24IRR: number;
  gram24Toman: number;
  gram18IRR: number;
  gram18Toman: number;
  mesghal24Toman: number;
  mesghal18Toman: number;
};

export type GoldApiPriceResponse = {
  price: number;
  symbol?: string;
  name?: string;
  currency?: string;
  updatedAt?: string;
};

export type ExchangeRateApiResponse = {
  result: "success" | "error";
  conversion_rates?: Record<string, number>;
  "error-type"?: string;
};
