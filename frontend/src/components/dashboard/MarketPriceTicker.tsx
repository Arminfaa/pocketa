"use client";

import { useEffect, useRef, useState } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { formatToman, formatUsd } from "@/lib/format";
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
  className?: string;
};

export function MarketPriceTicker({ market, loading, errorMessage, className }: Props) {
  const items = buildItems(market);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  pausedRef.current = paused;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || items.length === 0 || loading) return;

    let frame = 0;
    let last = performance.now();
    const speed = 32; // px per second

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!pausedRef.current) {
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 4) {
          if (el.scrollLeft >= maxScroll - 1) {
            el.scrollLeft = 0;
          } else {
            el.scrollLeft += speed * dt;
          }
        }
      }

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [items.length, loading]);

  function setPausedState(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
  }

  function scrollManual(direction: 1 | -1) {
    const el = viewportRef.current;
    if (!el) return;
    setPausedState(true);
    const amount = Math.max(160, Math.round(el.clientWidth * 0.5));
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

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

  // Duplicate for smoother looping when auto-scroll wraps
  const loop = [...items, ...items];

  return (
    <div
      className={cn("market-ticker", paused && "market-ticker--paused", className)}
      aria-label="قیمت طلا و ارز"
      onMouseEnter={() => setPausedState(true)}
      onMouseLeave={() => setPausedState(false)}
      onTouchStart={() => setPausedState(true)}
      onFocusCapture={() => setPausedState(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPausedState(false);
        }
      }}
    >
      <button
        type="button"
        className="market-ticker-nav market-ticker-nav--prev"
        aria-label="اسکرول به چپ"
        onClick={() => scrollManual(-1)}
      >
        <LeftOutlined />
      </button>

      <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
      <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />

      <div
        ref={viewportRef}
        className="market-ticker-viewport"
        dir="ltr"
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
          setPausedState(true);
        }}
      >
        <div className="market-ticker-track">
          {loop.map((item, i) => (
            <TickerChip key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="market-ticker-nav market-ticker-nav--next"
        aria-label="اسکرول به راست"
        onClick={() => scrollManual(1)}
      >
        <RightOutlined />
      </button>
    </div>
  );
}
