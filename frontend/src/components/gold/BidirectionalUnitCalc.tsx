"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Space, Typography } from "antd";
import { AmountInput } from "@/components/ui/amount-input";
import {
  DecimalInput,
  formatDecimalInputValue,
  parseDecimalInput,
} from "@/components/ui/decimal-input";
import { formatAmountInputValue, parseAmountInput } from "@/lib/amount";
import { formatToman } from "@/lib/format";

const { Text } = Typography;

type Props = {
  title: string;
  unitLabel: string;
  quantityLabel: string;
  totalLabel?: string;
  unitPriceToman: number;
  quantitySuffix?: string;
  maxDecimals?: number;
};

export function BidirectionalUnitCalc({
  title,
  unitLabel,
  quantityLabel,
  totalLabel = "مبلغ کل (تومان)",
  unitPriceToman,
  quantitySuffix,
  maxDecimals = 4,
}: Props) {
  const [quantity, setQuantity] = useState("");
  const [total, setTotal] = useState("");
  const lastEdited = useRef<"quantity" | "total" | null>(null);

  useEffect(() => {
    if (!unitPriceToman || unitPriceToman <= 0) return;

    if (lastEdited.current === "total") {
      const t = parseAmountInput(total);
      if (Number.isFinite(t) && t >= 0) {
        setQuantity(formatDecimalInputValue(t / unitPriceToman, maxDecimals));
      }
      return;
    }

    const q = parseDecimalInput(quantity);
    if (quantity.trim() && Number.isFinite(q) && q >= 0) {
      setTotal(formatAmountInputValue(q * unitPriceToman));
    }
  }, [unitPriceToman, maxDecimals]);

  function onQuantityChange(v: string) {
    lastEdited.current = "quantity";
    setQuantity(v);
    const q = parseDecimalInput(v);
    if (!v.trim()) {
      setTotal("");
      return;
    }
    if (Number.isFinite(q) && q >= 0 && unitPriceToman > 0) {
      setTotal(formatAmountInputValue(q * unitPriceToman));
    }
  }

  function onTotalChange(v: string) {
    lastEdited.current = "total";
    setTotal(v);
    const t = parseAmountInput(v);
    if (!v.trim()) {
      setQuantity("");
      return;
    }
    if (Number.isFinite(t) && t >= 0 && unitPriceToman > 0) {
      setQuantity(formatDecimalInputValue(t / unitPriceToman, maxDecimals));
    }
  }

  return (
    <Card size="small" title={title}>
      <Space orientation="vertical" size="middle" className="w-full">
        <Text type="secondary" className="text-xs">
          نرخ واحد: {formatToman(unitPriceToman)} / {unitLabel}
        </Text>

        <div>
          <Text type="secondary" className="mb-1 block text-xs">
            {quantityLabel}
            {quantitySuffix ? ` (${quantitySuffix})` : ""}
          </Text>
          <DecimalInput
            value={quantity}
            onChange={onQuantityChange}
            placeholder="0"
            maxDecimals={maxDecimals}
          />
        </div>

        <div>
          <Text type="secondary" className="mb-1 block text-xs">
            {totalLabel}
          </Text>
          <AmountInput value={total} onChange={onTotalChange} placeholder="۰" />
        </div>
      </Space>
    </Card>
  );
}
