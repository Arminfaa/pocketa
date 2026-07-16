"use client";

import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { formatToman } from "@/lib/format";
import { Card, Col, Flex, Grid, Row, Statistic, Typography } from "antd";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { BarChart, Bar, Legend } from "recharts";
import { useAccountFilterStore } from "@/stores/account-filter.store";

const { Text } = Typography;

export default function DashboardPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const dashboardQ = useQuery({
    queryKey: ["dashboard", selectedAccountId],
    queryFn: async () => {
      const qs = selectedAccountId ? `?accountId=${selectedAccountId}` : "";
      return (await api.get(`/api/dashboard${qs}`)).data.data;
    },
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

  const dashboard = dashboardQ.data;

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
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="موجودی فعلی" value={formatToman(dashboard.totals.balance)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="درآمد این ماه" value={formatToman(dashboard.totals.incomeThisMonth)} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="هزینه این ماه" value={formatToman(dashboard.totals.expenseThisMonth)} />
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
                  <Line type="monotone" dataKey="income" stroke="#06b6d4" name="درآمد" />
                  <Line type="monotone" dataKey="expense" stroke="#8b5cf6" name="هزینه" />
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
