"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  Col,
  Flex,
  Grid,
  Input,
  Row,
  Segmented,
  Select,
  Typography,
} from "antd";
import {
  FallOutlined,
  LineChartOutlined,
  PieChartOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { AmountText } from "@/components/ui/amount-text";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchCategoryReport, fetchMonthlyReport } from "@/services/reports";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { Sk } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";

const { Text } = Typography;

const PIE_FALLBACK = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

const ChartSk = () => <Sk className="h-[300px] w-full rounded-2xl md:h-[280px]" />;
const ChartSkSm = () => <Sk className="h-[260px] w-full rounded-2xl" />;

const ReportsTrendLineChart = dynamic(
  () => import("@/features/reports/ReportsCharts").then((m) => m.ReportsTrendLineChart),
  { ssr: false, loading: ChartSk }
);
const ReportsMonthBarChart = dynamic(
  () => import("@/features/reports/ReportsCharts").then((m) => m.ReportsMonthBarChart),
  { ssr: false, loading: ChartSk }
);
const ReportsExpensePieChart = dynamic(
  () => import("@/features/reports/ReportsCharts").then((m) => m.ReportsExpensePieChart),
  { ssr: false, loading: ChartSkSm }
);
const ReportsCategoryCompareChart = dynamic(
  () => import("@/features/reports/ReportsCharts").then((m) => m.ReportsCategoryCompareChart),
  { ssr: false, loading: ChartSkSm }
);

type ReportMode = "range" | "monthly";

export default function ReportsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const current = getJalaliMonthYear();
  const [mode, setMode] = useState<ReportMode>("monthly");
  const [months, setMonths] = useState(6);
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);

  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", selectedAccountId, months],
    queryFn: () => fetchMonthlyReport({ months, accountId: selectedAccountId }),
    enabled: mode === "range",
  });

  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId, month, year],
    queryFn: () =>
      fetchCategoryReport({ month, year, accountId: selectedAccountId }),
    enabled: mode === "monthly",
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

  const singleMonthBar = useMemo(() => {
    if (!categoriesQ.data) return [];
    return [
      {
        name: `${MONTH_LABELS[month - 1]} ${year}`,
        income: categoriesQ.data.incomeTotal ?? 0,
        expense: categoriesQ.data.expenseTotal ?? 0,
      },
    ];
  }, [categoriesQ.data, month, year]);

  const expensePie = useMemo(() => {
    return (categoriesQ.data?.expense ?? []).map((c, i) => ({
      name: c.name,
      value: c.amount,
      color: c.color || PIE_FALLBACK[i % PIE_FALLBACK.length]!,
    }));
  }, [categoriesQ.data]);

  const incomeValue =
    mode === "monthly"
      ? categoriesQ.isLoading
        ? "—"
        : formatToman(categoriesQ.data?.incomeTotal ?? 0)
      : monthlyQ.isLoading
        ? "—"
        : formatToman(monthlyQ.data?.summary.totalIncome ?? 0);

  const expenseValue =
    mode === "monthly"
      ? categoriesQ.isLoading
        ? "—"
        : formatToman(categoriesQ.data?.expenseTotal ?? 0)
      : monthlyQ.isLoading
        ? "—"
        : formatToman(monthlyQ.data?.summary.totalExpense ?? 0);

  const netValue =
    mode === "monthly"
      ? categoriesQ.isLoading
        ? "—"
        : formatToman(
            (categoriesQ.data?.incomeTotal ?? 0) - (categoriesQ.data?.expenseTotal ?? 0)
          )
      : monthlyQ.isLoading
        ? "—"
        : formatToman(monthlyQ.data?.summary.totalNet ?? 0);

  const monthOptions = [
    { value: 3, label: "۳ ماه" },
    { value: 6, label: "۶ ماه" },
    { value: 12, label: "۱۲ ماه" },
  ];

  return (
    <PageShell width="full">
      <PageHeader
        title="گزارش‌ها"
        icon={<PieChartOutlined />}
        description={
          selectedAccountId
            ? "گزارش‌ها بر اساس حساب انتخاب‌شده در هدر فیلتر شده‌اند."
            : "نمایش گزارش همه حساب‌ها. از هدر می‌توانید یک حساب را انتخاب کنید."
        }
      />

      <FilterBar>
        <FilterField className="sm:min-w-[14rem] sm:flex-[2]">
          <Segmented
            block
            value={mode}
            onChange={(v) => setMode(v as ReportMode)}
            options={[
              { value: "monthly", label: "گزارش ماهانه" },
              { value: "range", label: "روند چندماهه" },
            ]}
          />
        </FilterField>
        {mode === "monthly" ? (
          <>
            <FilterField label="ماه">
              <Select
                className="w-full"
                value={month}
                onChange={setMonth}
                options={MONTH_LABELS.map((label, idx) => ({
                  value: idx + 1,
                  label,
                }))}
              />
            </FilterField>
            <FilterField label="سال" className="sm:max-w-[8rem]">
              <Input
                dir="ltr"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || current.year)}
              />
            </FilterField>
          </>
        ) : null}
      </FilterBar>

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          <KpiCard
            label={mode === "monthly" ? "درآمد ماه" : "مجموع درآمد بازه"}
            value={incomeValue}
            tone="success"
            icon={<RiseOutlined />}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            label={mode === "monthly" ? "هزینه ماه" : "مجموع هزینه بازه"}
            value={expenseValue}
            tone="danger"
            icon={<FallOutlined />}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            label="خالص"
            value={netValue}
            tone="brand"
            icon={<LineChartOutlined />}
          />
        </Col>
      </Row>

      {mode === "range" ? (
        <SectionCard
          title="روند ماهانه درآمد و هزینه"
          extra={
            <Select
              value={months}
              onChange={setMonths}
              className={isMobile ? "w-full" : "w-[120px]"}
              options={monthOptions}
            />
          }
        >
          {monthlyQ.isLoading ? <ChartSk /> : null}
          {monthlyQ.error ? (
            <QueryError
              message="خطا در دریافت گزارش ماهانه."
              onRetry={() => void monthlyQ.refetch()}
            />
          ) : null}
          {monthlyQ.data ? (
            <ReportsTrendLineChart
              data={monthlyChart}
              height={isMobile ? 300 : 280}
              isMobile={isMobile}
            />
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard title={`درآمد و هزینه ${MONTH_LABELS[month - 1]} ${year}`}>
          {categoriesQ.isLoading ? <ChartSk /> : null}
          {categoriesQ.error ? (
            <QueryError
              message="خطا در دریافت گزارش ماهانه."
              onRetry={() => void categoriesQ.refetch()}
            />
          ) : null}
          {categoriesQ.data ? (
            <ReportsMonthBarChart
              data={singleMonthBar}
              height={isMobile ? 300 : 280}
              isMobile={isMobile}
            />
          ) : null}
        </SectionCard>
      )}

      {mode === "monthly" ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <SectionCard title="هزینه به تفکیک دسته">
                {categoriesQ.isLoading ? <ChartSkSm /> : null}
                {categoriesQ.data && expensePie.length > 0 ? (
                  <ReportsExpensePieChart data={expensePie} />
                ) : !categoriesQ.isLoading ? (
                  <Flex align="center" justify="center" className="h-[260px]">
                    <Text type="secondary">هزینه‌ای در این ماه ثبت نشده است.</Text>
                  </Flex>
                ) : null}
              </SectionCard>
            </Col>

            <Col xs={24} lg={12}>
              <SectionCard title="مقایسه دسته‌های هزینه">
                {categoriesQ.isLoading ? <ChartSkSm /> : null}
                {categoriesQ.data && (categoriesQ.data.expense?.length ?? 0) > 0 ? (
                  <ReportsCategoryCompareChart
                    data={categoriesQ.data.expense.map((c) => ({
                      name: c.name,
                      amount: c.amount,
                    }))}
                    isMobile={isMobile}
                  />
                ) : !categoriesQ.isLoading ? (
                  <Flex align="center" justify="center" className="h-[260px]">
                    <Text type="secondary">داده‌ای برای نمودار نیست.</Text>
                  </Flex>
                ) : null}
              </SectionCard>
            </Col>
          </Row>

          <SoftList
            header={
              <Text strong>
                بیشترین هزینه‌های {MONTH_LABELS[month - 1]} {year}
              </Text>
            }
          >
            {categoriesQ.isLoading ? (
              <SoftListItem>
                <div className="space-y-3 py-1" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Flex key={i} justify="space-between" align="center" gap="middle">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Sk className="h-4 w-36 max-w-full" />
                        <Sk className="h-3 w-48 max-w-full" />
                      </div>
                      <Sk className="h-4 w-20 shrink-0" />
                    </Flex>
                  ))}
                </div>
              </SoftListItem>
            ) : null}
            {!categoriesQ.isLoading && (categoriesQ.data?.topExpenses?.length ?? 0) === 0 ? (
              <SoftListItem>
                <Flex align="center" justify="center" className="py-5">
                  <Text type="secondary">هزینه‌ای برای نمایش وجود ندارد.</Text>
                </Flex>
              </SoftListItem>
            ) : null}
            {!categoriesQ.isLoading
              ? (categoriesQ.data?.topExpenses ?? []).map((tx) => (
                  <SoftListItem key={tx.id}>
                    <SoftListRow
                      title={tx.title}
                      subtitle={`${formatJalaliDate(tx.date)} · ${tx.category} · ${tx.account}`}
                      trailing={
                        <AmountText tone="expense" size="sm">
                          {formatToman(tx.amount)}
                        </AmountText>
                      }
                    />
                  </SoftListItem>
                ))
              : null}
          </SoftList>
        </>
      ) : null}
    </PageShell>
  );
}
