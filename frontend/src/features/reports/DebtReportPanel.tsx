"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button, Col, Flex, Input, Row, Segmented, Select, Tag, Typography } from "antd";
import {
  AccountBookOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FallOutlined,
  RiseOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  SoftAvatar,
  SoftList,
  SoftListItem,
  SoftListRow,
} from "@/components/ui/soft-list";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { AmountText } from "@/components/ui/amount-text";
import { Sk } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { cn } from "@/lib/cn";
import {
  fetchDebtReport,
  type DebtMonthItem,
  type DebtReportFilter,
  type DebtReportItem,
} from "@/services/reports";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";

const { Text } = Typography;

function kindLabel(item: DebtReportItem): string {
  if (item.kind === "one_time") {
    return item.role === "liability" ? "بدهی یک‌باره" : "طلب یک‌باره";
  }
  if (item.endMode === "months" && item.endMonths != null) {
    return `قسط (${toPersianDigits(String(item.paymentsMade))}/${toPersianDigits(String(item.endMonths))})`;
  }
  return item.role === "liability" ? "قسط/هزینه دوره‌ای" : "درآمد دوره‌ای";
}

function dueLabel(item: DebtReportItem): string {
  if (item.isOverdue) {
    if (item.daysUntil === 0) return "موعد امروز";
    return `${toPersianDigits(String(Math.abs(item.daysUntil)))} روز گذشته`;
  }
  if (item.daysUntil === 1) return "فردا";
  return `${toPersianDigits(String(item.daysUntil))} روز دیگر`;
}

function monthKindLabel(item: DebtMonthItem): string {
  if (item.kind === "one_time") {
    return item.role === "liability" ? "بدهی یک‌باره" : "طلب یک‌باره";
  }
  return item.role === "liability" ? "قسط/بدهی" : "طلب/سود/درآمد";
}

function ItemPlan({ item }: { item: DebtReportItem }) {
  if (item.settlementPlan.length === 0) {
    return <Text type="secondary">برنامه‌ای برای نمایش نیست.</Text>;
  }

  return (
    <div className="space-y-3">
      <Flex justify="space-between" align="center" gap={8} wrap="wrap">
        <Text type="secondary" className="text-xs">
          {item.planIsPreview
            ? "پایان مشخص نیست · پیش‌نمایش ۶ موعد بعدی"
            : "برنامه تسویه"}
        </Text>
        {item.estimatedRemaining != null ? (
          <Flex align="center" gap={6}>
            <Text type="secondary" className="text-xs">
              برآورد مانده
            </Text>
            <AmountText
              tone={item.role === "liability" ? "expense" : "income"}
              size="sm"
            >
              {formatToman(item.estimatedRemaining)}
            </AmountText>
          </Flex>
        ) : null}
      </Flex>

      <div className="overflow-hidden rounded-2xl bg-brand-500/[0.04] dark:bg-brand-500/[0.07]">
        <div className="flex flex-col divide-y divide-app-border/70">
          {item.settlementPlan.map((step) => (
            <div
              key={`${item.id}-${step.index}-${step.date}`}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-app-fg">
                  {item.kind === "one_time"
                    ? "سررسید"
                    : `قسط ${toPersianDigits(String(step.index))}`}
                </div>
                <div className="mt-0.5 text-xs text-app-muted">
                  {formatJalaliDate(step.date)}
                </div>
              </div>
              <AmountText
                tone={item.role === "liability" ? "expense" : "income"}
                size="sm"
              >
                {formatToman(step.amount)}
              </AmountText>
            </div>
          ))}
        </div>
      </div>

      <Link href="/recurring" className="inline-block">
        <Button size="small" type="link" className="!px-0">
          مدیریت در سررسیدها
        </Button>
      </Link>
    </div>
  );
}

export function DebtReportPanel() {
  const current = getJalaliMonthYear();
  const [filter, setFilter] = useState<DebtReportFilter>("all");
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [openId, setOpenId] = useState<string | null>(null);

  const debtQ = useQuery({
    queryKey: ["reports-debts", filter, month, year],
    queryFn: () => fetchDebtReport({ filter, month, year }),
  });

  const summary = debtQ.data?.summary;
  const monthSummary = debtQ.data?.monthSummary;
  const monthItems = debtQ.data?.monthItems ?? [];
  const items = debtQ.data?.items ?? [];
  const monthName = MONTH_LABELS[month - 1] ?? "";

  const filteredMonthItems = monthItems.filter((item) => {
    if (filter === "liability") return item.role === "liability";
    if (filter === "receivable") return item.role === "receivable";
    if (filter === "overdue") return !item.paid;
    return true;
  });

  return (
    <>
      <FilterBar>
        <FilterField className="sm:min-w-[18rem] sm:flex-[2]">
          <Segmented
            block
            value={filter}
            onChange={(v) => {
              setFilter(v as DebtReportFilter);
              setOpenId(null);
            }}
            options={[
              { value: "all", label: "همه" },
              { value: "liability", label: "بدهکار" },
              { value: "receivable", label: "طلبکار" },
              { value: "overdue", label: "معوق" },
            ]}
          />
        </FilterField>
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
      </FilterBar>

      <SectionCard
        title={`خلاصه ${monthName} ${toPersianDigits(String(year))}`}
        description="جمع بدهی/اقساط و طلب/سود/درآمد این ماه — پرداخت‌شده و مانده"
      >
        <div className="space-y-4">
          <div>
            <Text className="mb-2 block text-xs font-medium text-app-muted">
              بدهی و اقساط
            </Text>
            <Row gutter={[12, 12]}>
              <Col xs={8}>
                <KpiCard
                  label="کل ماه"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.liabilities.total ?? 0)
                  }
                  tone="danger"
                  icon={<FallOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.liabilities.totalCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
              <Col xs={8}>
                <KpiCard
                  label="پرداخت‌شده"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.liabilities.done ?? 0)
                  }
                  tone="success"
                  icon={<CheckCircleOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.liabilities.doneCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
              <Col xs={8}>
                <KpiCard
                  label="مانده"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.liabilities.remaining ?? 0)
                  }
                  tone="warning"
                  icon={<ClockCircleOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.liabilities.remainingCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
            </Row>
          </div>

          <div>
            <Text className="mb-2 block text-xs font-medium text-app-muted">
              طلب / سود / درآمد دوره‌ای
            </Text>
            <Row gutter={[12, 12]}>
              <Col xs={8}>
                <KpiCard
                  label="کل ماه"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.receivables.total ?? 0)
                  }
                  tone="brand"
                  icon={<RiseOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.receivables.totalCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
              <Col xs={8}>
                <KpiCard
                  label="دریافت‌شده"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.receivables.done ?? 0)
                  }
                  tone="success"
                  icon={<CheckCircleOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.receivables.doneCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
              <Col xs={8}>
                <KpiCard
                  label="دریافت‌نشده"
                  value={
                    debtQ.isLoading
                      ? "—"
                      : formatToman(monthSummary?.receivables.remaining ?? 0)
                  }
                  tone="warning"
                  icon={<ClockCircleOutlined />}
                  hint={
                    monthSummary
                      ? `${toPersianDigits(String(monthSummary.receivables.remainingCount))} مورد`
                      : undefined
                  }
                  size="sm"
                />
              </Col>
            </Row>
          </div>
        </div>
      </SectionCard>

      {!debtQ.isLoading && !debtQ.error ? (
        <SoftList
          header={
            <Text type="secondary" className="text-xs font-medium">
              اقلام {monthName} · {toPersianDigits(String(filteredMonthItems.length))} مورد
            </Text>
          }
        >
          {filteredMonthItems.length === 0 ? (
            <SoftListItem>
              <Flex align="center" justify="center" className="py-5">
                <Text type="secondary">برای این ماه موردی نیست.</Text>
              </Flex>
            </SoftListItem>
          ) : (
            filteredMonthItems.map((item) => {
              const isLiability = item.role === "liability";
              return (
                <SoftListItem
                  key={`month-${item.id}`}
                  className={cn(item.paid ? "bg-emerald-500/5" : undefined)}
                >
                  <SoftListRow
                    title={
                      <Flex align="center" gap={6} wrap="wrap">
                        <span className={cn(item.paid && "text-app-muted line-through")}>
                          {item.title}
                        </span>
                        <Tag
                          color={isLiability ? "red" : "green"}
                          className="!m-0 !rounded-lg !border-0 !px-2 !text-[11px]"
                        >
                          {isLiability ? "بدهکار" : "طلبکار"}
                        </Tag>
                        <Tag
                          color={item.paid ? "green" : "orange"}
                          className="!m-0 !rounded-lg !border-0 !px-2 !text-[11px]"
                        >
                          {item.paid
                            ? isLiability
                              ? "پرداخت‌شده"
                              : "دریافت‌شده"
                            : isLiability
                              ? "پرداخت‌نشده"
                              : "دریافت‌نشده"}
                        </Tag>
                      </Flex>
                    }
                    subtitle={
                      <>
                        {monthKindLabel(item)}
                        {item.category ? ` · ${item.category.name}` : ""}
                        {" · "}
                        {formatJalaliDate(item.nextPaymentDate)}
                      </>
                    }
                    trailing={
                      <AmountText
                        tone={isLiability ? "expense" : "income"}
                        size="sm"
                        className={cn(item.paid && "opacity-60")}
                      >
                        {formatToman(item.amount)}
                      </AmountText>
                    }
                  />
                </SoftListItem>
              );
            })
          )}
        </SoftList>
      ) : null}

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <KpiCard
            label="بدهی باز"
            value={debtQ.isLoading ? "—" : formatToman(summary?.liabilitiesDue ?? 0)}
            tone="danger"
            icon={<FallOutlined />}
            hint={
              summary
                ? `${toPersianDigits(String(summary.liabilityCount))} مورد · برآورد ${formatToman(summary.estimatedLiabilities)}`
                : undefined
            }
            size="sm"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            label="طلب باز"
            value={debtQ.isLoading ? "—" : formatToman(summary?.receivablesDue ?? 0)}
            tone="success"
            icon={<RiseOutlined />}
            hint={
              summary
                ? `${toPersianDigits(String(summary.receivableCount))} مورد · برآورد ${formatToman(summary.estimatedReceivables)}`
                : undefined
            }
            size="sm"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            label="خالص موقعیت"
            value={debtQ.isLoading ? "—" : formatToman(summary?.estimatedNet ?? 0)}
            tone="brand"
            icon={<SwapOutlined />}
            hint={
              summary
                ? summary.estimatedNet >= 0
                  ? "بیشتر طلبکارید"
                  : "بیشتر بدهکارید"
                : undefined
            }
            size="sm"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            label="معوق باز"
            value={debtQ.isLoading ? "—" : formatToman(summary?.overdueAmount ?? 0)}
            tone="warning"
            icon={<WarningOutlined />}
            hint={
              summary
                ? `${toPersianDigits(String(summary.overdueCount))} مورد`
                : undefined
            }
            size="sm"
          />
        </Col>
      </Row>

      {debtQ.isLoading ? (
        <SoftList
          header={
            <Text type="secondary" className="text-xs font-medium">
              اقلام باز و برنامه تسویه
            </Text>
          }
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <SoftListItem key={i}>
              <div className="flex items-start justify-between gap-3" aria-busy="true">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Sk className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <Sk className="h-4 w-36 max-w-full" />
                    <Sk className="h-3 w-48 max-w-full" />
                  </div>
                </div>
                <Sk className="h-4 w-20 shrink-0" />
              </div>
            </SoftListItem>
          ))}
        </SoftList>
      ) : null}

      {debtQ.error ? (
        <QueryError
          message="خطا در دریافت گزارش بدهی/طلب."
          onRetry={() => void debtQ.refetch()}
        />
      ) : null}

      {!debtQ.isLoading && !debtQ.error && items.length === 0 ? (
        <SoftList
          header={
            <Text type="secondary" className="text-xs font-medium">
              اقلام باز و برنامه تسویه
            </Text>
          }
        >
          <SoftListItem>
            <Flex vertical align="center" gap={8} className="py-6">
              <Text type="secondary">مورد فعالی برای این فیلتر نیست.</Text>
              <Link href="/recurring?new=1">
                <Button type="primary">ثبت بدهی یا طلب</Button>
              </Link>
            </Flex>
          </SoftListItem>
        </SoftList>
      ) : null}

      {!debtQ.isLoading && items.length > 0 ? (
        <SoftList
          header={
            <Flex justify="space-between" align="center" gap={8} wrap="wrap">
              <Text type="secondary" className="text-xs font-medium">
                {toPersianDigits(String(items.length))} مورد باز · برای دیدن برنامه تسویه لمس کنید
              </Text>
              <Link href="/recurring">
                <Button
                  size="small"
                  type="link"
                  className="!h-auto !px-0"
                  icon={<AccountBookOutlined />}
                >
                  سررسیدها
                </Button>
              </Link>
            </Flex>
          }
        >
          {items.map((item) => {
            const open = openId === item.id;
            const isLiability = item.role === "liability";

            return (
              <SoftListItem
                key={item.id}
                className={cn(item.isOverdue && "bg-amber-500/5", open && "bg-brand-500/[0.03]")}
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <SoftListRow
                  leading={
                    <SoftAvatar
                      className={cn(
                        "!h-10 !w-10 !rounded-xl !shadow-none",
                        isLiability
                          ? "!bg-red-500/12 !text-red-500"
                          : "!bg-emerald-500/12 !text-emerald-600"
                      )}
                    >
                      {isLiability ? <FallOutlined /> : <RiseOutlined />}
                    </SoftAvatar>
                  }
                  title={
                    <Flex align="center" gap={6} wrap="wrap">
                      <span>{item.title}</span>
                      <Tag
                        color={isLiability ? "red" : "green"}
                        className="!m-0 !rounded-lg !border-0 !px-2 !text-[11px]"
                      >
                        {isLiability ? "بدهکار" : "طلبکار"}
                      </Tag>
                      {item.isOverdue ? (
                        <Tag
                          color="orange"
                          className="!m-0 !rounded-lg !border-0 !px-2 !text-[11px]"
                        >
                          معوق
                        </Tag>
                      ) : null}
                    </Flex>
                  }
                  subtitle={
                    <>
                      {kindLabel(item)}
                      {item.category ? ` · ${item.category.name}` : ""}
                      {" · "}
                      {formatJalaliDate(item.nextPaymentDate)}
                      {" · "}
                      {dueLabel(item)}
                    </>
                  }
                  trailing={
                    <Flex vertical align="flex-end" gap={6}>
                      <AmountText
                        tone={isLiability ? "expense" : "income"}
                        size="sm"
                        caption={
                          item.estimatedRemaining != null &&
                          item.estimatedRemaining !== item.amount
                            ? `مانده ≈ ${formatToman(item.estimatedRemaining)}`
                            : undefined
                        }
                      >
                        {formatToman(item.amount)}
                      </AmountText>
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/10 text-[11px] text-brand-600 transition-transform dark:text-brand-300",
                          open && "rotate-180"
                        )}
                        aria-hidden
                      >
                        <DownOutlined />
                      </span>
                    </Flex>
                  }
                  footer={
                    open ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <ItemPlan item={item} />
                      </div>
                    ) : null
                  }
                />
              </SoftListItem>
            );
          })}
        </SoftList>
      ) : null}
    </>
  );
}
