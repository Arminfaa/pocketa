"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TickerSkeleton } from "@/components/skeletons";
import { toPersianDigits } from "@/lib/format";
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
    fetchDate?: string;
    fetchedAt?: string;
    sourceUpdatedAt?: string;
  } | null;
  currency: {
    usdFreeToman: number;
    usdtToman: number;
    fetchDate?: string;
    fetchedAt?: string;
    sourceUpdatedAt?: string;
  } | null;
  asOfDate?: string;
  lastUpdatedAt?: string;
  stale?: boolean;
  errors?: {
    gold?: string;
    currency?: string;
  };
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

/** ISO → «۱۴۰۵/۰۴/۲۷ · ۲۱:۱۰» in Asia/Tehran */
function formatTehranDateTime(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = timeParts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = timeParts.find((p) => p.type === "minute")?.value ?? "00";
  const jalaliNorm = jalali.replace(/[^\d۰-۹/]/g, "/").replace(/\/+/g, "/");
  return `${jalaliNorm} · ${toPersianDigits(`${hour}:${minute}`)}`;
}

function resolveLastUpdated(market?: MarketTickerData): string | null {
  if (!market) return null;
  const candidates = [
    market.lastUpdatedAt,
    market.gold?.fetchedAt,
    market.currency?.fetchedAt,
    market.gold?.sourceUpdatedAt,
    market.currency?.sourceUpdatedAt,
  ].filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  const latest = candidates
    .map((iso) => ({ iso, t: new Date(iso).getTime() }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t)[0];
  return latest ? formatTehranDateTime(latest.iso) : null;
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
    <div className="market-ticker-chip" dir="rtl">
      <span className="market-ticker-label">{item.label}</span>
      <span className="market-ticker-value">{item.amount}</span>
      <span className="market-ticker-unit">{item.unit}</span>
    </div>
  );
}

type MenuBox = { top: number; left: number; width: number };

type Props = {
  market?: MarketTickerData;
  loading?: boolean;
  errorMessage?: string;
  className?: string;
};

function staleHint(market?: MarketTickerData): string | null {
  if (!market?.stale) return null;
  const dates = [market.gold?.fetchDate, market.currency?.fetchDate].filter(Boolean) as string[];
  const oldest = dates.sort()[0];
  if (oldest) {
    return `قیمت ذخیره‌شده مربوط به ${toPersianDigits(oldest)} است — به‌روزرسانی امروز هنوز انجام نشده`;
  }
  return "قیمت‌ها مربوط به امروز نیست — در حال تلاش برای به‌روزرسانی";
}

export function MarketPriceTicker({ market, loading, errorMessage, className }: Props) {
  const items = buildItems(market);
  const staleMessage = staleHint(market);
  const updatedLabel = resolveLastUpdated(market);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuBox(null);
      return;
    }

    function updateBox() {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuBox({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    }

    updateBox();
    window.addEventListener("resize", updateBox);
    window.addEventListener("scroll", updateBox, true);
    return () => {
      window.removeEventListener("resize", updateBox);
      window.removeEventListener("scroll", updateBox, true);
    };
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen) return;
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [menuOpen]);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenu() {
    clearCloseTimer();
    setMenuOpen(true);
  }

  function toggleMenu() {
    clearCloseTimer();
    setMenuOpen((v) => !v);
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 120);
  }

  if (loading) {
    return <TickerSkeleton className={className} />;
  }

  if (!items.length) {
    return (
      <div className={cn("market-ticker market-ticker--empty", className)}>
        <span className="text-xs text-app-muted">
          {errorMessage || staleMessage || "قیمت‌ها در دسترس نیست"}
        </span>
      </div>
    );
  }

  const loop = [...items, ...items];
  const statusNote = staleMessage || errorMessage || null;

  const dropdown =
    mounted && menuOpen && menuBox
      ? createPortal(
          <div
            ref={menuRef}
            className="market-ticker-dropdown"
            role="list"
            dir="rtl"
            style={{
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
            }}
            onMouseEnter={openMenu}
            onMouseLeave={scheduleClose}
          >
            {updatedLabel ? (
              <div className="market-ticker-dropdown-row !items-start border-b border-app-border/70">
                <div className="w-full space-y-0.5">
                  <div className="text-[11px] text-app-muted">آخرین به‌روزرسانی</div>
                  <div className="text-xs font-semibold text-app-fg tabular-nums">
                    {updatedLabel}
                  </div>
                </div>
              </div>
            ) : null}
            {statusNote ? (
              <div className="market-ticker-dropdown-row !items-start">
                <span className="text-xs text-amber-600 dark:text-amber-300 leading-relaxed">
                  {statusNote}
                </span>
              </div>
            ) : null}
            {items.map((item) => (
              <div key={item.id} className="market-ticker-dropdown-row" role="listitem">
                <span className="market-ticker-label">{item.label}</span>
                <span className="market-ticker-dropdown-price">
                  <span className="market-ticker-value">{item.amount}</span>
                  <span className="market-ticker-unit">{item.unit}</span>
                </span>
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={rootRef}
        className={cn("market-ticker", menuOpen && "market-ticker--menu-open")}
        aria-label="قیمت طلا و ارز"
        aria-expanded={menuOpen}
        role="button"
        tabIndex={0}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={toggleMenu}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleMenu();
          }
        }}
      >
        <div className="market-ticker-strip">
          <div className="market-ticker-fade market-ticker-fade--start" aria-hidden />
          <div className="market-ticker-fade market-ticker-fade--end" aria-hidden />

          <div className="market-ticker-viewport">
            <div className="market-ticker-track" dir="ltr">
              {loop.map((item, i) => (
                <TickerChip key={`${item.id}-${i}`} item={item} />
              ))}
            </div>
          </div>
        </div>

        {dropdown}
      </div>
      {statusNote ? (
        <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300/90">
          {statusNote}
        </p>
      ) : null}
    </div>
  );
}
