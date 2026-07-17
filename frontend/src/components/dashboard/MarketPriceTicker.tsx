"use client";

import { formatToman, formatUsd } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export type MarketTickerData = {
  gold: {
    gram18kUsd: number;
    gram24kUsd: number;
    mesghal18kUsd: number;
    mesghal24kUsd: number;
    quarterCoinUsd?: number;
    gram18kToman: number | null;
    gram24kToman: number | null;
    mesghal18kToman: number | null;
    mesghal24kToman: number | null;
    quarterCoinToman?: number | null;
  } | null;
  currency: {
    usdFreeToman: number;
    usdtToman: number;
  } | null;
};

type TickerItem = {
  id: string;
  label: string;
  value: string;
  sub?: string;
};

function buildItems(market: MarketTickerData | undefined): TickerItem[] {
  if (!market) return [];
  const items: TickerItem[] = [];
  const { gold, currency } = market;

  if (gold) {
    items.push(
      {
        id: "g18",
        label: "گرم ۱۸ عیار",
        value:
          gold.gram18kToman != null
            ? formatToman(gold.gram18kToman)
            : formatUsd(gold.gram18kUsd),
        sub: formatUsd(gold.gram18kUsd),
      },
      {
        id: "g24",
        label: "گرم ۲۴ عیار",
        value:
          gold.gram24kToman != null
            ? formatToman(gold.gram24kToman)
            : formatUsd(gold.gram24kUsd),
        sub: formatUsd(gold.gram24kUsd),
      },
      {
        id: "m18",
        label: "مثقال ۱۸ عیار",
        value:
          gold.mesghal18kToman != null
            ? formatToman(gold.mesghal18kToman)
            : formatUsd(gold.mesghal18kUsd),
        sub: formatUsd(gold.mesghal18kUsd),
      },
      {
        id: "m24",
        label: "مثقال ۲۴ عیار",
        value:
          gold.mesghal24kToman != null
            ? formatToman(gold.mesghal24kToman)
            : formatUsd(gold.mesghal24kUsd),
        sub: formatUsd(gold.mesghal24kUsd),
      },
      {
        id: "qcoin",
        label: "ربع سکه",
        value:
          gold.quarterCoinToman != null
            ? formatToman(gold.quarterCoinToman)
            : gold.quarterCoinUsd != null
              ? formatUsd(gold.quarterCoinUsd)
              : "—",
        sub: gold.quarterCoinUsd != null ? formatUsd(gold.quarterCoinUsd) : undefined,
      }
    );
  }

  if (currency) {
    items.push(
      {
        id: "usd",
        label: "دلار آزاد",
        value: formatToman(currency.usdFreeToman),
      },
      {
        id: "usdt",
        label: "تتر",
        value: formatToman(currency.usdtToman),
      }
    );
  }

  return items;
}

function TickerChip({ item }: { item: TickerItem }) {
  return (
    <div className="market-ticker-chip">
      <span className="market-ticker-label">{item.label}</span>
      <span className="market-ticker-value">{item.value}</span>
      {item.sub ? <span className="market-ticker-sub">{item.sub}</span> : null}
    </div>
  );
}

type Props = {
  market?: MarketTickerData;
  loading?: boolean;
  errorMessage?: string;
};

export function MarketPriceTicker({ market, loading, errorMessage }: Props) {
  const items = buildItems(market);

  if (loading) {
    return (
      <div className="market-ticker" aria-busy="true">
        <Skeleton className="h-10 w-full" rows={1} />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="market-ticker market-ticker--empty">
        <span className="text-xs text-app-muted">
          {errorMessage || "قیمت‌ها در دسترس نیست"}
        </span>
      </div>
    );
  }

  // Duplicate for seamless loop
  const loop = [...items, ...items];

  return (
    <div className="market-ticker" aria-label="قیمت طلا و ارز">
      <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
      <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />
      <div className="market-ticker-track">
        {loop.map((item, i) => (
          <TickerChip key={`${item.id}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
