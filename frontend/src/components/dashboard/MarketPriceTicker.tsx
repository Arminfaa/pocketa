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
  // RTL: راست = نام، بعد قیمت بولد، بعد تومان
  return (
    <div className="market-ticker-chip" dir="rtl">
      <span className="market-ticker-label">{item.label}</span>
      <span className="market-ticker-value">{item.amount}</span>
      <span className="market-ticker-unit">{item.unit}</span>
    </div>
  );
}

function normalizeOffset(offset: number, half: number): number {
  if (half <= 0) return 0;
  let x = offset % half;
  if (x < 0) x += half;
  return x;
}

type Props = {
  market?: MarketTickerData;
  loading?: boolean;
  errorMessage?: string;
  className?: string;
};

export function MarketPriceTicker({ market, loading, errorMessage, className }: Props) {
  const items = buildItems(market);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const [paused, setPaused] = useState(false);

  function setPausedState(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
  }

  function applyTransform() {
    const track = trackRef.current;
    if (!track) return;
    const half = track.scrollWidth / 2;
    offsetRef.current = normalizeOffset(offsetRef.current, half || 1);
    // حرکت به سمت راست (مناسب RTL): آیتم‌های جدید از چپ وارد می‌شوند
    track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
  }

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0 || loading) return;

    let frame = 0;
    let last = performance.now();
    const speed = 42; // px / sec
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!reduceMotion && !pausedRef.current && !draggingRef.current) {
        offsetRef.current += speed * dt;
        applyTransform();
      }

      frame = requestAnimationFrame(step);
    };

    // Wait one frame so duplicated track has layout width
    frame = requestAnimationFrame(() => {
      applyTransform();
      frame = requestAnimationFrame(step);
    });

    const onResize = () => applyTransform();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyTransform reads refs
  }, [items.length, loading]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    setPausedState(true);
    draggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    offsetRef.current = dragStartOffsetRef.current + dx;
    applyTransform();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
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

  const loop = [...items, ...items];

  return (
    <div
      className={cn("market-ticker", paused && "market-ticker--paused", className)}
      aria-label="قیمت طلا و ارز"
      onMouseEnter={() => setPausedState(true)}
      onMouseLeave={() => {
        draggingRef.current = false;
        applyTransform();
        setPausedState(false);
      }}
    >
      <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
      <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />

      <div
        className="market-ticker-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={trackRef} className="market-ticker-track" dir="ltr">
          {loop.map((item, i) => (
            <TickerChip key={`${item.id}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
