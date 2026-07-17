"use client";

import { useQuery } from "@tanstack/react-query";
import { Button, Col, Flex, Row, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { fetchGoldPrices } from "@/services/gold-prices";
import { GoldPriceSummary } from "@/components/gold/GoldPriceSummary";
import { BidirectionalUnitCalc } from "@/components/gold/BidirectionalUnitCalc";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";

const { Title, Text } = Typography;

const REFETCH_MS = 60_000;

export default function GoldCalculatorPage() {
  const goldQ = useQuery({
    queryKey: ["gold-prices"],
    queryFn: fetchGoldPrices,
    refetchInterval: REFETCH_MS,
    staleTime: REFETCH_MS,
  });

  const prices = goldQ.data;
  const usdToman = prices ? prices.usdToIRR / 10 : 0;

  return (
    <Space orientation="vertical" size="large" className="w-full max-w-5xl">
      <Flex justify="space-between" align="flex-end" gap="middle" wrap="wrap">
        <div>
          <Title level={4} className="!m-0">
            محاسبه‌گر طلا / دلار
          </Title>
          <Text type="secondary">
            میزان (گرم، مثقال یا تعداد دلار) یا مبلغ کل را وارد کنید — فیلد دیگر خودکار
            محاسبه می‌شود.
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          loading={goldQ.isFetching}
          onClick={() => void goldQ.refetch()}
        >
          بروزرسانی قیمت
        </Button>
      </Flex>

      {goldQ.isLoading ? <Skeleton className="h-40 w-full" rows={3} /> : null}

      {goldQ.error ? (
        <QueryError
          message="خطا در دریافت قیمت طلا یا دلار. کلید ExchangeRate-API را در سرور بررسی کنید."
          onRetry={() => void goldQ.refetch()}
        />
      ) : null}

      {prices ? (
        <>
          <GoldPriceSummary prices={prices} />

          <div>
            <Title level={5} className="!mb-3">
              طلا
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <BidirectionalUnitCalc
                  title="طلای ۲۴ عیار — گرم"
                  unitLabel="گرم"
                  quantityLabel="وزن طلا"
                  quantitySuffix="گرم"
                  unitPriceToman={prices.gram24Toman}
                />
              </Col>
              <Col xs={24} md={12}>
                <BidirectionalUnitCalc
                  title="طلای ۱۸ عیار — گرم"
                  unitLabel="گرم"
                  quantityLabel="وزن طلا"
                  quantitySuffix="گرم"
                  unitPriceToman={prices.gram18Toman}
                />
              </Col>
              <Col xs={24} md={12}>
                <BidirectionalUnitCalc
                  title="طلای ۲۴ عیار — مثقال"
                  unitLabel="مثقال"
                  quantityLabel="وزن طلا"
                  quantitySuffix="مثقال"
                  unitPriceToman={prices.mesghal24Toman}
                />
              </Col>
              <Col xs={24} md={12}>
                <BidirectionalUnitCalc
                  title="طلای ۱۸ عیار — مثقال"
                  unitLabel="مثقال"
                  quantityLabel="وزن طلا"
                  quantitySuffix="مثقال"
                  unitPriceToman={prices.mesghal18Toman}
                />
              </Col>
            </Row>
          </div>

          <div>
            <Title level={5} className="!mb-3">
              دلار
            </Title>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <BidirectionalUnitCalc
                  title="دلار آمریکا"
                  unitLabel="دلار"
                  quantityLabel="تعداد دلار"
                  unitPriceToman={usdToman}
                  maxDecimals={2}
                />
              </Col>
            </Row>
          </div>
        </>
      ) : null}
    </Space>
  );
}
