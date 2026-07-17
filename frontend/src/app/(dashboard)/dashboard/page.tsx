"use client";

import api from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatToman } from "@/lib/format";
import { App, Button, Card, Col, Flex, Grid, Row, Statistic, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { MarketPriceTicker } from "@/components/dashboard/MarketPriceTicker";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { enablePushNotifications, fetchPushStatus } from "@/lib/push";

const { Text } = Typography;

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

  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (selectedAccountId) qs.set("accountId", selectedAccountId);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return (await api.get(`/api/reports/categories${suffix}`)).data.data;
    },
  });

  const pushStatusQ = useQuery({ queryKey: ["push-status"], queryFn: fetchPushStatus });

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
        <Row gutter={[16, 16]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card>
                <Skeleton className="h-16 w-full" rows={1} />
              </Card>
            </Col>
          ))}
        </Row>
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
                <Statistic title="موجودی فعلی" value={formatToman(dashboard.totals.balance)} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="درآمد این ماه"
                  value={formatToman(dashboard.totals.incomeThisMonth)}
                  className="[&_.ant-statistic-content-value]:text-emerald-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="هزینه این ماه"
                  value={formatToman(dashboard.totals.expenseThisMonth)}
                  className="[&_.ant-statistic-content-value]:text-red-500"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="درصد پس‌انداز"
                  value={dashboard.totals.savingsPercent.toFixed(1)}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="نمودار درآمد و هزینه (این ماه)">
                {dashboard ? (
                  <ResponsiveContainer width="100%" height={isMobile ? 300 : 260}>
                    <BarChart
                      data={[
                        {
                          name: "این ماه",
                          income: dashboard.totals.incomeThisMonth,
                          expense: dashboard.totals.expenseThisMonth,
                        },
                      ]}
                    >
                      <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={70} />
                      <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                      <Legend />
                      <Bar dataKey="income" fill="#10b981" name="درآمد" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="expense" fill="#ef4444" name="هزینه" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Text type="secondary">اطلاعات کافی نیست.</Text>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="بیشترین دسته‌های هزینه">
                {categoriesQ.isLoading ? (
                  <Skeleton className="h-[260px] w-full" />
                ) : categoriesQ.data ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={categoriesQ.data.expense.map((c: { name: string; amount: number }) => ({
                        name: c.name,
                        amount: c.amount,
                      }))}
                    >
                      <XAxis
                        dataKey="name"
                        angle={isMobile ? -35 : 0}
                        textAnchor={isMobile ? "end" : "middle"}
                        height={isMobile ? 60 : 30}
                        tick={{ fontSize: isMobile ? 10 : 12 }}
                      />
                      <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={70} />
                      <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                      <Legend />
                      <Bar dataKey="amount" fill="#ef4444" name="مبلغ" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
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
