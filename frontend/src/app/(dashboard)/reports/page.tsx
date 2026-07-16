"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Flex,
  Input,
  List,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
} from "antd";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchCategoryReport, fetchMonthlyReport } from "@/services/reports";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";

const { Title, Text } = Typography;

const PIE_FALLBACK = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

export default function ReportsPage() {
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const current = getJalaliMonthYear();
  const [months, setMonths] = useState(6);
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);

  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", selectedAccountId, months],
    queryFn: () => fetchMonthlyReport({ months, accountId: selectedAccountId }),
  });

  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId, month, year],
    queryFn: () =>
      fetchCategoryReport({ month, year, accountId: selectedAccountId }),
  });

  const monthlyChart = useMemo(() => {
    const data = monthlyQ.data;
    if (!data) return [];
    return data.labels.map((label, i) => ({
      label,
      income: data.income[i] ?? 0,
      expense: data.expense[i] ?? 0,
      net: data.net?.[i] ?? (data.income[i] ?? 0) - (data.expense[i] ?? 0),
    }));
  }, [monthlyQ.data]);

  const expensePie = useMemo(() => {
    return (categoriesQ.data?.expense ?? []).map((c, i) => ({
      name: c.name,
      value: c.amount,
      color: c.color || PIE_FALLBACK[i % PIE_FALLBACK.length],
    }));
  }, [categoriesQ.data]);

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          گزارش‌ها
        </Title>
        <Text type="secondary">
          {selectedAccountId
            ? "گزارش‌ها بر اساس حساب انتخاب‌شده در هدر فیلتر شده‌اند."
            : "نمایش گزارش همه حساب‌ها. از هدر می‌توانید یک حساب را انتخاب کنید."}
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="مجموع درآمد بازه"
              value={
                monthlyQ.isLoading
                  ? "—"
                  : formatToman(monthlyQ.data?.summary.totalIncome ?? 0)
              }
              valueStyle={{ color: "#34d399", fontSize: 20 }}
              loading={monthlyQ.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="مجموع هزینه بازه"
              value={
                monthlyQ.isLoading
                  ? "—"
                  : formatToman(monthlyQ.data?.summary.totalExpense ?? 0)
              }
              valueStyle={{ color: "#f87171", fontSize: 20 }}
              loading={monthlyQ.isLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="خالص"
              value={
                monthlyQ.isLoading ? "—" : formatToman(monthlyQ.data?.summary.totalNet ?? 0)
              }
              valueStyle={{ color: "#06b6d4", fontSize: 20 }}
              loading={monthlyQ.isLoading}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="روند ماهانه درآمد و هزینه"
        extra={
          <Select
            value={months}
            onChange={setMonths}
            style={{ width: 120 }}
            options={[
              { value: 3, label: "۳ ماه" },
              { value: 6, label: "۶ ماه" },
              { value: 12, label: "۱۲ ماه" },
            ]}
          />
        }
      >
        {monthlyQ.isLoading ? <Skeleton className="h-[280px] w-full" /> : null}
        {monthlyQ.error ? (
          <QueryError
            message="خطا در دریافت گزارش ماهانه."
            onRetry={() => void monthlyQ.refetch()}
          />
        ) : null}
        {monthlyQ.data ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyChart}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(value) => formatToman(Number(value ?? 0))}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="income" name="درآمد" stroke="#06b6d4" strokeWidth={2} />
              <Line type="monotone" dataKey="expense" name="هزینه" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="net" name="خالص" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12}>
          <Text type="secondary">ماه تحلیل دسته‌ها</Text>
          <Select
            style={{ width: "100%", marginTop: 8 }}
            value={month}
            onChange={setMonth}
            options={MONTH_LABELS.map((label, idx) => ({
              value: idx + 1,
              label,
            }))}
          />
        </Col>
        <Col xs={24} sm={12}>
          <Text type="secondary">سال</Text>
          <Input
            style={{ marginTop: 8 }}
            dir="ltr"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || current.year)}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="هزینه به تفکیک دسته">
            {categoriesQ.isLoading ? <Skeleton className="h-[260px] w-full" /> : null}
            {categoriesQ.data && expensePie.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                    {expensePie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : !categoriesQ.isLoading ? (
              <Flex align="center" justify="center" style={{ height: 260 }}>
                <Text type="secondary">هزینه‌ای در این ماه ثبت نشده است.</Text>
              </Flex>
            ) : null}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="مقایسه دسته‌های هزینه">
            {categoriesQ.isLoading ? <Skeleton className="h-[260px] w-full" /> : null}
            {categoriesQ.data && (categoriesQ.data.expense?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={categoriesQ.data.expense.map((c) => ({
                    name: c.name,
                    amount: c.amount,
                  }))}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                  <Bar dataKey="amount" name="مبلغ" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : !categoriesQ.isLoading ? (
              <Flex align="center" justify="center" style={{ height: 260 }}>
                <Text type="secondary">داده‌ای برای نمودار نیست.</Text>
              </Flex>
            ) : null}
          </Card>
        </Col>
      </Row>

      <Card title={`بیشترین هزینه‌های ${MONTH_LABELS[month - 1]} ${year}`}>
        {categoriesQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
        <List
          dataSource={categoriesQ.data?.topExpenses ?? []}
          locale={{ emptyText: "هزینه‌ای برای نمایش وجود ندارد." }}
          renderItem={(tx) => (
            <List.Item>
              <Flex justify="space-between" align="center" gap="middle" style={{ width: "100%" }}>
                <div style={{ minWidth: 0 }}>
                  <Text strong ellipsis>
                    {tx.title}
                  </Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatJalaliDate(tx.date)} · {tx.category} · {tx.account}
                    </Text>
                  </div>
                </div>
                <Text strong style={{ color: "#f87171", whiteSpace: "nowrap" }}>
                  {formatToman(tx.amount)}
                </Text>
              </Flex>
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
