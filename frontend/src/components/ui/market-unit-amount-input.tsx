"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flex, Select, Typography } from "antd";
import { AmountInput } from "@/components/ui/amount-input";
import api from "@/services/api";
import { parseAmountInput } from "@/lib/amount";
import { formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { GoldKind } from "@/services/investments";

const { Text } = Typography;

export type AmountMarketUnit = "toman" | "usd" | "usdt" | "gold";

type MarketPrices = {
  gold: {
    gram18kToman: number | null;
    quarterCoinToman?: number | null;
    halfCoinToman?: number | null;
    fullCoinToman?: number | null;
  } | null;
  currency: {
    usdFreeToman: number;
    usdtToman: number;
  } | null;
};

const UNIT_OPTIONS: { value: AmountMarketUnit; label: string }[] = [
  { value: "toman", label: "تومان" },
  { value: "usd", label: "دلار" },
  { value: "usdt", label: "تتر" },
  { value: "gold", label: "طلا" },
];

export const GOLD_KIND_OPTIONS: { value: GoldKind; label: string }[] = [
  { value: "melted", label: "گرمی ۱۸ عیار" },
  { value: "quarter_coin", label: "ربع سکه" },
  { value: "half_coin", label: "نیم سکه" },
  { value: "full_coin", label: "تمام سکه" },
];

export function isCoinGoldKind(kind: GoldKind | string | null | undefined): boolean {
  return kind === "quarter_coin" || kind === "half_coin" || kind === "full_coin";
}

export function goldKindRateLabel(kind: GoldKind): string {
  if (kind === "quarter_coin") return "ربع سکه";
  if (kind === "half_coin") return "نیم سکه";
  if (kind === "full_coin") return "تمام سکه";
  return "گرم طلای ۱۸ عیار";
}

function unitRateLabel(unit: AmountMarketUnit, goldKind: GoldKind): string {
  if (unit === "usd") return "دلار آزاد";
  if (unit === "usdt") return "تتر";
  if (unit === "gold") return goldKindRateLabel(goldKind);
  return "تومان";
}

function resolveUnitRate(
  unit: AmountMarketUnit,
  market: MarketPrices | undefined,
  goldKind: GoldKind
): number | null {
  if (unit === "toman") return 1;
  if (!market) return null;
  if (unit === "usd") return market.currency?.usdFreeToman ?? null;
  if (unit === "usdt") return market.currency?.usdtToman ?? null;
  if (goldKind === "quarter_coin") return market.gold?.quarterCoinToman ?? null;
  if (goldKind === "half_coin") return market.gold?.halfCoinToman ?? null;
  if (goldKind === "full_coin") return market.gold?.fullCoinToman ?? null;
  return market.gold?.gram18kToman ?? null;
}

function formatRateFa(rate: number): string {
  return new Intl.NumberFormat("fa-IR").format(Math.round(rate));
}

function formatQtyFa(qty: number, decimals: number): string {
  return toPersianDigits(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }).format(qty)
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  unit: AmountMarketUnit;
  onUnitChange: (unit: AmountMarketUnit) => void;
  goldKind?: GoldKind;
  onGoldKindChange?: (kind: GoldKind) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

/**
 * Amount field with unit switch (تومان / دلار / تتر / طلا).
 * For gold, a subtype picker chooses gram vs coin kinds.
 * Non-toman values show live Toman equivalent from market rates.
 */
export function MarketUnitAmountInput({
  value,
  onChange,
  unit,
  onUnitChange,
  goldKind = "melted",
  onGoldKindChange,
  className,
  inputClassName,
  placeholder,
}: Props) {
  const marketQ = useQuery({
    queryKey: ["market-prices"],
    queryFn: async () => (await api.get("/api/market-prices")).data.data as MarketPrices,
    staleTime: 5 * 60_000,
    enabled: unit !== "toman",
  });

  const unitRate = resolveUnitRate(unit, marketQ.data, goldKind);
  const coinMode = unit === "gold" && isCoinGoldKind(goldKind);
  const allowDecimals = unit !== "toman" && !coinMode;
  const decimalPlaces = coinMode ? 0 : unit === "gold" ? 3 : unit === "toman" ? 0 : 2;

  const quantity = useMemo(() => parseAmountInput(value), [value]);
  const tomanAmount = useMemo(() => {
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (unit === "toman") return Math.round(quantity);
    if (unitRate == null || unitRate <= 0) return null;
    return Math.max(1, Math.round(quantity * unitRate));
  }, [quantity, unit, unitRate]);

  const placeholderText =
    placeholder ??
    (unit === "toman"
      ? "مبلغ تومان"
      : unit === "gold"
        ? coinMode
          ? "تعداد سکه"
          : "مقدار گرم"
        : "مقدار");

  return (
    <div className={cn("w-full", className)}>
      <Flex gap={8} align="flex-start" className="w-full">
        <Select
          className="shrink-0 !w-[6.5rem]"
          value={unit}
          options={UNIT_OPTIONS}
          onChange={(next) => {
            onUnitChange(next);
            onChange("");
            if (next === "gold" && !goldKind) onGoldKindChange?.("melted");
          }}
          aria-label="واحد مبلغ"
        />
        <div className="min-w-0 flex-1">
          <AmountInput
            placeholder={placeholderText}
            value={value}
            onChange={onChange}
            className={inputClassName}
            allowDecimals={allowDecimals}
            decimalPlaces={decimalPlaces}
            showWords={unit === "toman"}
            disabled={unit !== "toman" && marketQ.isLoading}
          />
        </div>
      </Flex>

      {unit === "gold" ? (
        <div className="mt-2">
          <Select
            className="w-full"
            value={goldKind}
            options={GOLD_KIND_OPTIONS}
            onChange={(next) => {
              onGoldKindChange?.(next);
              onChange("");
            }}
            aria-label="نوع طلا"
          />
        </div>
      ) : null}

      {unit !== "toman" ? (
        <div className="mt-1.5 space-y-0.5">
          {marketQ.isLoading ? (
            <Text type="secondary" className="text-xs">
              در حال دریافت نرخ روز…
            </Text>
          ) : null}
          {marketQ.isError || (unitRate == null && !marketQ.isLoading) ? (
            <Text type="danger" className="text-xs">
              نرخ {unitRateLabel(unit, goldKind)} در دسترس نیست.
            </Text>
          ) : null}
          {unitRate != null && unitRate > 0 ? (
            <>
              <Text type="secondary" className="block text-xs">
                نرخ روز {unitRateLabel(unit, goldKind)}: {formatToman(unitRate)}
              </Text>
              {tomanAmount != null ? (
                <Text className="block text-xs font-medium text-app-fg">
                  معادل{" "}
                  {formatQtyFa(quantity, decimalPlaces)} × {formatRateFa(unitRate)} ={" "}
                  {formatToman(tomanAmount)}
                </Text>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Resolve Toman amount; for gold/usd also returns quantity for asset-linked debts. */
export function resolveMarketUnitTomanAmount(
  rawValue: string,
  unit: AmountMarketUnit,
  market?: MarketPrices | null,
  goldKind: GoldKind = "melted"
):
  | {
      amount: number;
      assetQuantity?: number;
      assetType?: "gold" | "usd";
      goldKind?: GoldKind;
    }
  | { error: string } {
  const quantity = parseAmountInput(rawValue);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "مبلغ معتبر نیست" };
  }

  if (unit === "toman") {
    return { amount: Math.round(quantity) };
  }

  if (unit === "gold" && isCoinGoldKind(goldKind)) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: "تعداد سکه باید عدد صحیح باشد" };
    }
  }

  const rate = resolveUnitRate(unit, market ?? undefined, goldKind);
  if (rate == null || rate <= 0) {
    return { error: `نرخ ${unitRateLabel(unit, goldKind)} در دسترس نیست` };
  }

  const amount = Math.max(1, Math.round(quantity * rate));

  if (unit === "gold") {
    return {
      amount,
      assetQuantity: quantity,
      assetType: "gold",
      goldKind,
    };
  }
  if (unit === "usd") {
    return { amount, assetQuantity: quantity, assetType: "usd" };
  }
  // usdt: convert once to toman (no live re-price asset link yet)
  return { amount };
}
