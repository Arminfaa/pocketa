"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Flex, Row, Select, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import api from "@/services/api";
import { AmountInput } from "@/components/ui/amount-input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import {
  formatAmountInputValue,
  formatDecimalAmountInputValue,
  parseAmountInput,
} from "@/lib/amount";
import { formatToman } from "@/lib/format";

const { Text, Title } = Typography;

type MarketPrices = {
  gold: {
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

type CalcKind = "gold18" | "gold24" | "mesghal18" | "mesghal24" | "quarterCoin" | "usd";

const kindOptions: { value: CalcKind; label: string }[] = [
  { value: "gold18", label: "طلا ۱۸ عیار (گرم)" },
  { value: "gold24", label: "طلا ۲۴ عیار (گرم)" },
  { value: "mesghal18", label: "مثقال ۱۸ عیار" },
  { value: "mesghal24", label: "مثقال ۲۴ عیار" },
  { value: "quarterCoin", label: "ربع سکه" },
  { value: "usd", label: "دلار آزاد" },
];

function unitLabel(kind: CalcKind): string {
  if (kind === "usd") return "دلار";
  if (kind === "quarterCoin") return "تعداد";
  if (kind.startsWith("mesghal")) return "مثقال";
  return "گرم";
}

function resolveUnitPrice(kind: CalcKind, market: MarketPrices | undefined): number | null {
  if (!market) return null;
  if (kind === "usd") return market.currency?.usdFreeToman ?? null;
  if (kind === "gold18") return market.gold?.gram18kToman ?? null;
  if (kind === "gold24") return market.gold?.gram24kToman ?? null;
  if (kind === "mesghal18") return market.gold?.mesghal18kToman ?? null;
  if (kind === "quarterCoin") return market.gold?.quarterCoinToman ?? null;
  return market.gold?.mesghal24kToman ?? null;
}

export function AssetCalculator() {
  const [kind, setKind] = useState<CalcKind>("gold18");
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const lastEdited = useRef<"quantity" | "total" | null>(null);

  const marketQ = useQuery({
    queryKey: ["market-prices"],
    queryFn: async () => (await api.get("/api/market-prices")).data.data as MarketPrices,
    staleTime: 5 * 60_000,
  });

  const unitPrice = resolveUnitPrice(kind, marketQ.data);
  const qtyDecimals = kind === "quarterCoin" ? 0 : kind === "usd" ? 2 : 3;

  useEffect(() => {
    if (unitPrice == null || unitPrice <= 0 || !lastEdited.current) return;

    if (lastEdited.current === "total") {
      const t = parseAmountInput(total);
      if (Number.isFinite(t) && t >= 0) {
        setQuantity(formatDecimalAmountInputValue(t / unitPrice, qtyDecimals));
      }
      return;
    }

    const q = parseAmountInput(quantity);
    if (quantity.trim() && Number.isFinite(q) && q >= 0) {
      setTotal(formatAmountInputValue(q * unitPrice));
    }
  }, [unitPrice, qtyDecimals]); // eslint-disable-line react-hooks/exhaustive-deps -- only reprice when rate changes

  function onKindChange(next: CalcKind) {
    setKind(next);
    setQuantity("");
    setTotal("");
    lastEdited.current = null;
  }

  function onQuantityChange(v: string) {
    lastEdited.current = "quantity";
    setQuantity(v);
    if (!v.trim()) {
      setTotal("");
      return;
    }
    const q = parseAmountInput(v);
    if (Number.isFinite(q) && q >= 0 && unitPrice != null && unitPrice > 0) {
      setTotal(formatAmountInputValue(q * unitPrice));
    }
  }

  function onTotalChange(v: string) {
    lastEdited.current = "total";
    setTotal(v);
    if (!v.trim()) {
      setQuantity("");
      return;
    }
    const t = parseAmountInput(v);
    if (Number.isFinite(t) && t >= 0 && unitPrice != null && unitPrice > 0) {
      setQuantity(formatDecimalAmountInputValue(t / unitPrice, qtyDecimals));
    }
  }

  return (
    <Flex vertical gap="large">
      <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
        <div>
          <Title level={5} className="!mb-1">
            محاسبه‌گر طلا / دلار
          </Title>
          <Text type="secondary" className="text-xs">
            مقدار یا مبلغ را وارد کنید — طرف دیگر با قیمت روز محاسبه می‌شود.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={marketQ.isFetching}
          onClick={() => void marketQ.refetch()}
        >
          بروزرسانی قیمت
        </Button>
      </Flex>

      {marketQ.isLoading ? <Skeleton className="h-40 w-full" rows={2} /> : null}

      {marketQ.error ? (
        <QueryError
          message="خطا در دریافت قیمت روز."
          onRetry={() => void marketQ.refetch()}
        />
      ) : null}

      {marketQ.data ? (
        <Card>
          <Flex vertical gap="middle">
            <div>
              <Text type="secondary" className="text-xs">
                نوع
              </Text>
              <Select
                className="w-full"
                value={kind}
                options={kindOptions}
                onChange={onKindChange}
              />
            </div>

            {unitPrice != null ? (
              <Text type="secondary" className="text-xs">
                نرخ روز: {formatToman(unitPrice)} / {unitLabel(kind)}
              </Text>
            ) : (
              <Text type="danger" className="text-xs">
                قیمت این مورد در دسترس نیست.
              </Text>
            )}

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Text type="secondary" className="mb-1 block text-xs">
                  {kind === "quarterCoin" ? "تعداد ربع سکه" : `مقدار (${unitLabel(kind)})`}
                </Text>
                <AmountInput
                  value={quantity}
                  onChange={onQuantityChange}
                  placeholder={kind === "quarterCoin" ? "مثلاً ۲" : "مثلاً ۱۰"}
                  allowDecimals={kind !== "quarterCoin"}
                  decimalPlaces={qtyDecimals}
                  showWords={false}
                  disabled={unitPrice == null}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Text type="secondary" className="mb-1 block text-xs">
                  مبلغ (تومان)
                </Text>
                <AmountInput
                  value={total}
                  onChange={onTotalChange}
                  placeholder="۰"
                  disabled={unitPrice == null}
                />
              </Col>
            </Row>
          </Flex>
        </Card>
      ) : null}
    </Flex>
  );
}
