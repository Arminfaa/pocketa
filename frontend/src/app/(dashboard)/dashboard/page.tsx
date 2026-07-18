"use client";

import api from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { formatToman } from "@/lib/format";
import { App, Button, Card, Col, Flex, Grid, Row, Statistic, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { QueryError } from "@/components/ui/query-error";
import { DashboardSkeleton } from "@/components/skeletons";
import { Sk } from "@/components/ui/skeleton";
import { MarketPriceTicker } from "@/components/dashboard/MarketPriceTicker";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { enablePushNotifications, fetchPushStatus } from "@/lib/push";

const { Text } = Typography;

const DashboardIncomeExpenseChart = dynamic(
  () =>
    import("@/features/dashboard/DashboardCharts").then(
      (m) => m.DashboardIncomeExpenseChart
    ),
  {
    ssr: false,
    loading: () => <Sk className="h-[300px] w-full rounded-2xl md:h-[260px]" />,
  }
);

const DashboardCategoryBarChart = dynamic(
  () =>
    import("@/features/dashboard/DashboardCharts").then(
      (m) => m.DashboardCategoryBarChart
    ),
  {
    ssr: false,
    loading: () => <Sk className="h-[300px] w-full rounded-2xl md:h-[260px]" />,
  }
);

type MarketPrices = {
  gold: {
    ounceUsd: number;
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
    changePercent: number;
    fetchDate: string;
    fetchedAt: string;
  } | null;
  currency: {
    usdFreeToman: number;
    usdtToman: number;
    usdChange: number;
    usdtChange: number;
    fetchDate: string;
    fetchedAt: string;
  } | null;
  errors?: {
    gold?: string;
    currency?: string;
  };
};

export default function DashboardPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const dashboardQ = useQuery({
    queryKey: ["dashboard", selectedAccountId],
    queryFn: async () => {
      const qs = selectedAccountId ? `?accountId=${selectedAccountId}` : "";
      return (await api.get(`/api/dashboard${qs}`)).data.data;
    },
  });

  const marketQ = useQuery({
    queryKey: ["market-prices"],
    queryFn: async () => {
      try {
        return (await api.get("/api/market-prices")).data.data as MarketPrices;
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        const msg = ax.response?.data?.message;
        throw new Error(msg || (err instanceof Error ? err.message : "خطا در دریافت قیمت‌ها"));
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const dashboardReady = dashboardQ.isSuccess;

  // Defer secondary work until KPIs are on screen
  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (selectedAccountId) qs.set("accountId", selectedAccountId);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return (await api.get(`/api/reports/categories${suffix}`)).data.data;
    },
    enabled: dashboardReady,
  });

  const pushStatusQ = useQuery({
    queryKey: ["push-status"],
    queryFn: fetchPushStatus,
    enabled: dashboardReady,
    staleTime: 5 * 60_000,
  });

  const pushMutation = useMutation({
    mutationFn: enablePushNotifications,
    onSuccess: () => {
      message.success("یادآوری پوش روی این دستگاه فعال شد");
      void queryClient.invalidateQueries({ queryKey: ["push-status"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "فعال‌سازی پوش ناموفق بود");
    },
  });

  const dashboard = dashboardQ.data;
  const market = marketQ.data;
  const showPushPrompt =
    pushStatusQ.isSuccess &&
    !pushStatusQ.data.thisDevice &&
    pushStatusQ.data.configured !== false &&
    pushStatusQ.data.supported !== false;

  const tickerError =
    marketQ.error instanceof Error
      ? marketQ.error.message
      : market?.errors?.gold || market?.errors?.currency;

  const chartHeight = isMobile ? 300 : 260;

  return (
    <Flex vertical gap="large">
      <MarketPriceTicker
        market={market}
        loading={marketQ.isLoading}
        errorMessage={tickerError}
      />

      {showPushPrompt ? (
        <Card size="small">
          <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
            <div className="min-w-0">
              <Text strong>
                <BellOutlined className="me-1" />
                یادآوری پوش
              </Text>
              <div>
                <Text type="secondary" className="text-xs">
                  از ۳ روز قبل موعد بدهی/قسط، در ساعت مشخص‌شده نوتیف می‌آید. خاموش کردن از تنظیمات.
                </Text>
              </div>
            </div>
            <Button
              icon={<BellOutlined />}
              loading={pushMutation.isPending}
              onClick={() => pushMutation.mutate()}
            >
              فعال‌سازی روی این دستگاه
            </Button>
          </Flex>
        </Card>
      ) : null}

      {dashboardQ.isLoading ? (
        <DashboardSkeleton />
      ) : dashboardQ.error ? (
        <QueryError
          message="خطا در دریافت اطلاعات داشبورد."
          onRetry={() => void dashboardQ.refetch()}
        />
      ) : dashboard ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic title="موجودی نقد" value={formatToman(dashboard.totals.balance)} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="درآمد عملیاتی این ماه"
                  value={formatToman(dashboard.totals.incomeThisMonth)}
                  className="[&_.ant-statistic-content-value]:text-emerald-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="هزینه عملیاتی این ماه"
                  value={formatToman(dashboard.totals.expenseThisMonth)}
                  className="[&_.ant-statistic-content-value]:text-red-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="درصد پس‌انداز عملیاتی"
                  value={dashboard.totals.savingsPercent.toFixed(1)}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>

          {dashboard.netWorth && !selectedAccountId ? (
            <Card title="ارزش خالص (خلاصه تراز)">
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={8} md={4}>
                  <Statistic title="نقد" value={formatToman(dashboard.netWorth.cash)} />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="سرمایه‌گذاری"
                    value={formatToman(dashboard.netWorth.investmentsValue)}
                  />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="بدهی‌ها"
                    value={formatToman(dashboard.netWorth.liabilities)}
                    className="[&_.ant-statistic-content-value]:text-red-500"
                  />
                </Col>
                <Col xs={12} sm={8} md={5}>
                  <Statistic
                    title="طلب‌ها"
                    value={formatToman(dashboard.netWorth.receivables)}
                    className="[&_.ant-statistic-content-value]:text-emerald-500"
                  />
                </Col>
                <Col xs={24} sm={16} md={5}>
                  <Statistic
                    title="ارزش خالص"
                    value={formatToman(dashboard.netWorth.netWorth)}
                    className="[&_.ant-statistic-content-value]:text-brand-500"
                  />
                </Col>
              </Row>
              <Text type="secondary" className="mt-2 block text-xs">
                ارزش خالص = نقد + سرمایه‌گذاری − بدهی + طلب (سررسیدهای فعال)
              </Text>
            </Card>
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="نمودار درآمد و هزینه (این ماه)">
                <DashboardIncomeExpenseChart
                  income={dashboard.totals.incomeThisMonth}
                  expense={dashboard.totals.expenseThisMonth}
                  height={chartHeight}
                  tickFontSize={isMobile ? 10 : 12}
                />
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="بیشترین دسته‌های هزینه">
                {categoriesQ.isLoading || !dashboardReady ? (
                  <Sk className="h-[300px] w-full rounded-2xl md:h-[260px]" />
                ) : categoriesQ.data ? (
                  <DashboardCategoryBarChart
                    data={categoriesQ.data.expense.map(
                      (c: { name: string; amount: number }) => ({
                        name: c.name,
                        amount: c.amount,
                      })
                    )}
                    height={chartHeight}
                    isMobile={isMobile}
                  />
                ) : (
                  <Text type="secondary">اطلاعات کافی نیست.</Text>
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : null}
    </Flex>
  );
}
