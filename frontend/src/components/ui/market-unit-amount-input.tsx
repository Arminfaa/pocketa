"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flex, Select, Typography } from "antd";
import { AmountInput } from "@/components/ui/amount-input";
import api from "@/services/api";
import { parseAmountInput } from "@/lib/amount";
import { formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

const { Text } = Typography;

export type AmountMarketUnit = "toman" | "usd" | "usdt" | "gold";

type MarketPrices = {
  gold: {
    gram18kToman: number | null;
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

function unitRateLabel(unit: AmountMarketUnit): string {
  if (unit === "usd") return "دلار آزاد";
  if (unit === "usdt") return "تتر";
  if (unit === "gold") return "گرم طلای ۱۸ عیار";
  return "تومان";
}

function resolveUnitRate(
  unit: AmountMarketUnit,
  market: MarketPrices | undefined
): number | null {
  if (unit === "toman") return 1;
  if (!market) return null;
  if (unit === "usd") return market.currency?.usdFreeToman ?? null;
  if (unit === "usdt") return market.currency?.usdtToman ?? null;
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
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

/**
 * Amount field with unit switch (تومان / دلار / تتر / طلا).
 * Non-toman values show live Toman equivalent from market rates.
 */
export function MarketUnitAmountInput({
  value,
  onChange,
  unit,
  onUnitChange,
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

  const unitRate = resolveUnitRate(unit, marketQ.data);
  const allowDecimals = unit !== "toman";
  const decimalPlaces = unit === "gold" ? 3 : unit === "toman" ? 0 : 2;

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
        ? "مقدار گرم"
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

      {unit !== "toman" ? (
        <div className="mt-1.5 space-y-0.5">
          {marketQ.isLoading ? (
            <Text type="secondary" className="text-xs">
              در حال دریافت نرخ روز…
            </Text>
          ) : null}
          {marketQ.isError || (unitRate == null && !marketQ.isLoading) ? (
            <Text type="danger" className="text-xs">
              نرخ {unitRateLabel(unit)} در دسترس نیست.
            </Text>
          ) : null}
          {unitRate != null && unitRate > 0 ? (
            <>
              <Text type="secondary" className="block text-xs">
                نرخ روز {unitRateLabel(unit)}: {formatToman(unitRate)}
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

/** Resolve the Toman amount to submit for the selected unit. */
export function resolveMarketUnitTomanAmount(
  rawValue: string,
  unit: AmountMarketUnit,
  market?: MarketPrices | null
): { amount: number } | { error: string } {
  const quantity = parseAmountInput(rawValue);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "مبلغ معتبر نیست" };
  }

  if (unit === "toman") {
    return { amount: Math.round(quantity) };
  }

  const rate = resolveUnitRate(unit, market ?? undefined);
  if (rate == null || rate <= 0) {
    return { error: `نرخ ${unitRateLabel(unit)} در دسترس نیست` };
  }

  return { amount: Math.max(1, Math.round(quantity * rate)) };
}
