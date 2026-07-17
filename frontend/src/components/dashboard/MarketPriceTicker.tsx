"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

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
  amount: string;
  unit: string;
};

function formatAmountFa(amount: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(amount));
}

function formatAmountUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function tomanItem(
  id: string,
  label: string,
  toman: number | null | undefined,
  usdFallback?: number
): TickerItem | null {
  if (toman != null) {
    return { id, label, amount: formatAmountFa(toman), unit: "تومان" };
  }
  if (usdFallback != null) {
    return { id, label, amount: formatAmountUsd(usdFallback), unit: "$" };
  }
  return null;
}

function buildItems(market: MarketTickerData | undefined): TickerItem[] {
  if (!market) return [];
  const items: TickerItem[] = [];
  const { gold, currency } = market;

  if (gold) {
    const goldItems = [
      tomanItem("g18", "گرم ۱۸ عیار", gold.gram18kToman, gold.gram18kUsd),
      tomanItem("g24", "گرم ۲۴ عیار", gold.gram24kToman, gold.gram24kUsd),
      tomanItem("m18", "مثقال ۱۸ عیار", gold.mesghal18kToman, gold.mesghal18kUsd),
      tomanItem("m24", "مثقال ۲۴ عیار", gold.mesghal24kToman, gold.mesghal24kUsd),
      tomanItem("qcoin", "ربع سکه", gold.quarterCoinToman, gold.quarterCoinUsd),
    ];
    for (const item of goldItems) {
      if (item) items.push(item);
    }
  }

  if (currency) {
    items.push(
      {
        id: "usd",
        label: "دلار آزاد",
        amount: formatAmountFa(currency.usdFreeToman),
        unit: "تومان",
      },
      {
        id: "usdt",
        label: "تتر",
        amount: formatAmountFa(currency.usdtToman),
        unit: "تومان",
      }
    );
  }

  return items;
}

function TickerChip({ item }: { item: TickerItem }) {
  return (
    <div className="market-ticker-chip">
      <span className="market-ticker-label">{item.label}</span>
      <span className="market-ticker-value">{item.amount}</span>
      <span className="market-ticker-unit">{item.unit}</span>
    </div>
  );
}

/** Keep scroll inside the first half of a duplicated track for seamless looping. */
function normalizeLoopScroll(el: HTMLDivElement) {
  const half = el.scrollWidth / 2;
  if (half <= 0) return;
  while (el.scrollLeft >= half) el.scrollLeft -= half;
  while (el.scrollLeft < 0) el.scrollLeft += half;
}

type Props = {
  market?: MarketTickerData;
  loading?: boolean;
  errorMessage?: string;
  className?: string;
};

export function MarketPriceTicker({ market, loading, errorMessage, className }: Props) {
  const items = buildItems(market);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  function setPausedState(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || items.length === 0 || loading) return;

    let frame = 0;
    let last = performance.now();
    const speed = 36; // px / sec

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) {
        const half = el.scrollWidth / 2;
        // Only auto-scroll when content overflows (one set wider than viewport)
        if (half > el.clientWidth + 4) {
          el.scrollLeft += speed * dt;
          normalizeLoopScroll(el);
        }
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);

    const onWheel = (e: WheelEvent) => {
      if (!pausedRef.current) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      normalizeLoopScroll(el);
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("wheel", onWheel);
    };
  }, [items.length, loading]);

  if (loading) {
    return (
      <div className={cn("market-ticker", className)} aria-busy="true">
        <Skeleton className="h-10 w-full" rows={1} />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={cn("market-ticker market-ticker--empty", className)}>
        <span className="text-xs text-app-muted">
          {errorMessage || "قیمت‌ها در دسترس نیست"}
        </span>
      </div>
    );
  }

  // Two copies → seamless infinite loop via half-width wrap
  const loop = [...items, ...items];

  return (
    <div
      className={cn("market-ticker", paused && "market-ticker--paused", className)}
      aria-label="قیمت طلا و ارز"
      onMouseEnter={() => setPausedState(true)}
      onMouseLeave={() => {
        const el = viewportRef.current;
        if (el) normalizeLoopScroll(el);
        setPausedState(false);
      }}
      onTouchStart={() => setPausedState(true)}
      onTouchEnd={() => {
        const el = viewportRef.current;
        if (el) normalizeLoopScroll(el);
        setPausedState(false);
      }}
      onTouchCancel={() => setPausedState(false)}
    >
      <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
      <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />

      <div
        ref={viewportRef}
        className="market-ticker-viewport"
        dir="ltr"
        onScroll={() => {
          const el = viewportRef.current;
          if (el && pausedRef.current) normalizeLoopScroll(el);
        }}
      >
        <div className="market-ticker-track">
          {loop.map((item, i) => (
            <TickerChip key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
