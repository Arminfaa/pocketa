"use client";

import { useRef, useState } from "react";
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

function readTranslateX(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return 0;
  try {
    const matrix = new DOMMatrixReadOnly(t);
    return matrix.m41;
  } catch {
    return 0;
  }
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
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  function clearManualTransform() {
    const track = trackRef.current;
    if (!track) return;
    track.style.animation = "";
    track.style.transform = "";
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (!track) return;

    draggingRef.current = true;
    setDragging(true);

    // Freeze current animated position, then take over with manual transform
    const currentX = readTranslateX(track);
    track.style.animation = "none";
    track.style.transform = `translate3d(${currentX}px, 0, 0)`;

    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = currentX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const track = trackRef.current;
    if (!track) return;

    const half = track.scrollWidth / 2 || 1;
    let next = dragStartOffsetRef.current + (e.clientX - dragStartXRef.current);
    next = ((next % half) + half) % half;
    track.style.transform = `translate3d(${next}px, 0, 0)`;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // If pointer left the ticker, CSS :hover is gone → resume animation from start of loop
    // If still hovering, keep frozen (animation stays none until mouseleave)
    const root = e.currentTarget.closest(".market-ticker");
    if (!root?.matches(":hover")) {
      clearManualTransform();
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
      className={cn("market-ticker", dragging && "market-ticker--dragging", className)}
      aria-label="قیمت طلا و ارز"
      onMouseLeave={() => {
        draggingRef.current = false;
        setDragging(false);
        // Leaving hover must always restart CSS infinite animation
        clearManualTransform();
      }}
    >
      <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
      <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />

      <div
        className="market-ticker-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
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
