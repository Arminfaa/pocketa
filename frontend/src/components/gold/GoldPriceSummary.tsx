"use client";

import { Card, Col, Row, Space, Typography } from "antd";
import type { GoldPrices } from "@/types/gold-price";
import { formatToman, toPersianDigits } from "@/lib/format";

const { Text, Title } = Typography;

type Props = {
  prices: GoldPrices;
  compact?: boolean;
};

export function GoldPriceSummary({ prices, compact = false }: Props) {
  const usdToman = prices.usdToIRR / 10;

  const items = [
    { label: "هر گرم ۲۴ عیار", value: prices.gram24Toman },
    { label: "هر گرم ۱۸ عیار", value: prices.gram18Toman },
    { label: "هر مثقال ۲۴ عیار", value: prices.mesghal24Toman },
    { label: "هر مثقال ۱۸ عیار", value: prices.mesghal18Toman },
  ];

  if (compact) {
    return (
      <Card size="small" className="border-amber-400/30 bg-amber-500/5">
        <Space orientation="vertical" size={4} className="w-full">
          <Text strong className="text-amber-600 dark:text-amber-400">
            قیمت لحظه‌ای طلا
          </Text>
          <Row gutter={[8, 8]}>
            {items.map((item) => (
              <Col key={item.label} xs={12} sm={6}>
                <Text type="secondary" className="text-xs block">
                  {item.label}
                </Text>
                <Text strong className="text-sm whitespace-nowrap">
                  {formatToman(item.value)}
                </Text>
              </Col>
            ))}
          </Row>
          <Text type="secondary" className="text-xs">
            دلار: {formatToman(usdToman)} · اونس:{" "}
            {toPersianDigits(prices.goldOunceUSD.toFixed(2))} USD
          </Text>
        </Space>
      </Card>
    );
  }

  return (
    <Card title="قیمت‌های لحظه‌ای">
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col key={item.label} xs={24} sm={12} md={6}>
            <div className="rounded-xl border border-slate-400/15 p-3">
              <Text type="secondary" className="text-xs">
                {item.label}
              </Text>
              <Title level={5} className="!mb-0 !mt-1">
                {formatToman(item.value)}
              </Title>
            </div>
          </Col>
        ))}
        <Col xs={24} sm={12} md={6}>
          <div className="rounded-xl border border-slate-400/15 p-3">
            <Text type="secondary" className="text-xs">
              هر دلار آمریکا
            </Text>
            <Title level={5} className="!mb-0 !mt-1">
              {formatToman(usdToman)}
            </Title>
          </div>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <div className="rounded-xl border border-slate-400/15 p-3">
            <Text type="secondary" className="text-xs">
              اونس طلا (XAU)
            </Text>
            <Title level={5} className="!mb-0 !mt-1" dir="ltr">
              {toPersianDigits(prices.goldOunceUSD.toFixed(2))} USD
            </Title>
          </div>
        </Col>
      </Row>
    </Card>
  );
}
