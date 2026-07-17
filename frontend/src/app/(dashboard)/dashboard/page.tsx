"use client";

import api from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatToman, formatUsd } from "@/lib/format";
import { App, Button, Card, Col, Flex, Grid, Row, Statistic, Typography } from "antd";
import { BellOutlined } from "@ant-design/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { BarChart, Bar, Legend } from "recharts";
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
    gram18kToman: number | null;
    gram24kToman: number | null;
    mesghal18kToman: number | null;
    mesghal24kToman: number | null;
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

  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", selectedAccountId],
    queryFn: async () => {
      const qs = new URLSearchParams({ months: "6" });
      if (selectedAccountId) qs.set("accountId", selectedAccountId);
      return (await api.get(`/api/reports/monthly?${qs.toString()}`)).data.data;
    },
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
  const gold = market?.gold;
  const currency = market?.currency;
  const showPushPrompt =
    pushStatusQ.isSuccess &&
    !pushStatusQ.data.thisDevice &&
    pushStatusQ.data.configured !== false &&
    pushStatusQ.data.supported !== false;

  if (dashboardQ.isLoading) {
    return (
      <Row gutter={[16, 16]}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Col key={i} xs={24} sm={12} lg={6}>
            <Card>
              <Skeleton className="h-16 w-full" rows={1} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (dashboardQ.error) {
    return (
      <QueryError
        message="خطا در دریافت اطلاعات داشبورد."
        onRetry={() => void dashboardQ.refetch()}
      />
    );
  }

  return (
    <Flex vertical gap="large">
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

      <Card
        title="قیمت طلا"
        extra={
          gold ? (
            <Text type="secondary" className="text-xs">
              به‌روز: {gold.fetchDate}
              {gold.changePercent
                ? ` · اونس ${gold.changePercent > 0 ? "+" : ""}${gold.changePercent.toFixed(2)}%`
                : ""}
            </Text>
          ) : null
        }
      >
        {marketQ.isLoading ? (
          <Row gutter={[16, 16]}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} lg={6}>
                <Skeleton className="h-16 w-full" rows={1} />
              </Col>
            ))}
          </Row>
        ) : marketQ.error ? (
          <Text type="secondary">
            قیمت طلا در دسترس نیست
            {marketQ.error instanceof Error && marketQ.error.message
              ? ` — ${marketQ.error.message}`
              : ""}
            .
          </Text>
        ) : !gold ? (
          <Text type="secondary">
            قیمت طلا در دسترس نیست
            {market?.errors?.gold ? ` — ${market.errors.gold}` : ""}.
          </Text>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="گرم ۱۸ عیار"
                value={
                  gold.gram18kToman != null
                    ? formatToman(gold.gram18kToman)
                    : formatUsd(gold.gram18kUsd)
                }
              />
              <Text type="secondary" className="text-xs">
                {formatUsd(gold.gram18kUsd)}
              </Text>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="گرم ۲۴ عیار"
                value={
                  gold.gram24kToman != null
                    ? formatToman(gold.gram24kToman)
                    : formatUsd(gold.gram24kUsd)
                }
              />
              <Text type="secondary" className="text-xs">
                {formatUsd(gold.gram24kUsd)}
              </Text>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="مثقال ۱۸ عیار"
                value={
                  gold.mesghal18kToman != null
                    ? formatToman(gold.mesghal18kToman)
                    : formatUsd(gold.mesghal18kUsd)
                }
              />
              <Text type="secondary" className="text-xs">
                {formatUsd(gold.mesghal18kUsd)}
              </Text>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title="مثقال ۲۴ عیار"
                value={
                  gold.mesghal24kToman != null
                    ? formatToman(gold.mesghal24kToman)
                    : formatUsd(gold.mesghal24kUsd)
                }
              />
              <Text type="secondary" className="text-xs">
                {formatUsd(gold.mesghal24kUsd)}
              </Text>
            </Col>
          </Row>
        )}
      </Card>

      <Card
        title="قیمت ارز"
        extra={
          currency ? (
            <Text type="secondary" className="text-xs">
              به‌روز: {currency.fetchDate}
            </Text>
          ) : null
        }
      >
        {marketQ.isLoading ? (
          <Row gutter={[16, 16]}>
            {Array.from({ length: 2 }).map((_, i) => (
              <Col key={i} xs={24} sm={12}>
                <Skeleton className="h-14 w-full" rows={1} />
              </Col>
            ))}
          </Row>
        ) : marketQ.error || !currency ? (
          <Text type="secondary">
            قیمت ارز در دسترس نیست
            {market?.errors?.currency
              ? ` — ${market.errors.currency}`
              : marketQ.error instanceof Error && marketQ.error.message
                ? ` — ${marketQ.error.message}`
                : ""}
            .
          </Text>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Statistic title="دلار آزاد" value={formatToman(currency.usdFreeToman)} />
            </Col>
            <Col xs={24} sm={12}>
              <Statistic title="تتر" value={formatToman(currency.usdtToman)} />
            </Col>
          </Row>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="نمودار درآمد و هزینه (۶ ماه اخیر)">
            {monthlyQ.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : monthlyQ.data ? (
              <ResponsiveContainer width="100%" height={isMobile ? 300 : 260}>
                <LineChart
                  data={monthlyQ.data.labels.map((label: string, i: number) => ({
                    label,
                    income: monthlyQ.data.income[i],
                    expense: monthlyQ.data.expense[i],
                  }))}
                >
                  <XAxis
                    dataKey="label"
                    angle={isMobile ? -35 : 0}
                    textAnchor={isMobile ? "end" : "middle"}
                    height={isMobile ? 60 : 30}
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                  />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#10b981" name="درآمد" />
                  <Line type="monotone" dataKey="expense" stroke="#ef4444" name="هزینه" />
                </LineChart>
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
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" fill="#ef4444" name="مبلغ" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text type="secondary">اطلاعات کافی نیست.</Text>
            )}
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
