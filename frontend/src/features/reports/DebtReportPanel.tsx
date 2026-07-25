"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Button, Collapse, Col, Flex, Row, Segmented, Tag, Typography } from "antd";
import {
  AccountBookOutlined,
  FallOutlined,
  RiseOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { AmountText } from "@/components/ui/amount-text";
import { Sk } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import {
  fetchDebtReport,
  type DebtReportFilter,
  type DebtReportItem,
} from "@/services/reports";
import { formatJalaliDate, formatToman } from "@/lib/format";

const { Text } = Typography;

function kindLabel(item: DebtReportItem): string {
  if (item.kind === "one_time") {
    return item.role === "liability" ? "بدهی یک‌باره" : "طلب یک‌باره";
  }
  if (item.endMode === "months" && item.endMonths != null) {
    return `قسط (${item.paymentsMade}/${item.endMonths})`;
  }
  return item.role === "liability" ? "قسط/هزینه دوره‌ای" : "درآمد دوره‌ای";
}

function dueLabel(item: DebtReportItem): string {
  if (item.isOverdue) {
    if (item.daysUntil === 0) return "موعد امروز";
    return `${Math.abs(item.daysUntil)} روز گذشته`;
  }
  if (item.daysUntil === 1) return "فردا";
  return `${item.daysUntil} روز دیگر`;
}

function ItemPlan({ item }: { item: DebtReportItem }) {
  if (item.settlementPlan.length === 0) {
    return <Text type="secondary">برنامه‌ای برای نمایش نیست.</Text>;
  }

  return (
    <div className="space-y-2">
      {item.planIsPreview ? (
        <Text type="secondary" className="text-xs">
          پایان مشخص نیست؛ پیش‌نمایش ۶ موعد بعدی.
        </Text>
      ) : null}
      {item.estimatedRemaining != null ? (
        <Flex justify="space-between" align="center" className="mb-1">
          <Text type="secondary" className="text-xs">
            برآورد مانده کل
          </Text>
          <AmountText
            tone={item.role === "liability" ? "expense" : "income"}
            size="sm"
          >
            {formatToman(item.estimatedRemaining)}
          </AmountText>
        </Flex>
      ) : null}
      <SoftList className="!shadow-none !rounded-xl">
        {item.settlementPlan.map((step) => (
          <SoftListItem key={`${item.id}-${step.index}-${step.date}`}>
            <SoftListRow
              title={
                <span className="text-sm">
                  {item.kind === "one_time" ? "سررسید" : `قسط ${step.index}`}
                </span>
              }
              subtitle={formatJalaliDate(step.date)}
              trailing={
                <AmountText
                  tone={item.role === "liability" ? "expense" : "income"}
                  size="sm"
                >
                  {formatToman(step.amount)}
                </AmountText>
              }
            />
          </SoftListItem>
        ))}
      </SoftList>
      <div className="pt-1">
        <Link href="/recurring">
          <Button size="small" type="link" className="!px-0">
            مدیریت در سررسیدها
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function DebtReportPanel() {
  const [filter, setFilter] = useState<DebtReportFilter>("all");

  const debtQ = useQuery({
    queryKey: ["reports-debts", filter],
    queryFn: () => fetchDebtReport({ filter }),
  });

  const summary = debtQ.data?.summary;
  const items = debtQ.data?.items ?? [];

  return (
    <>
      <FilterBar>
        <FilterField className="sm:min-w-[18rem] sm:flex-[2]">
          <Segmented
            block
            value={filter}
            onChange={(v) => setFilter(v as DebtReportFilter)}
            options={[
              { value: "all", label: "همه" },
              { value: "liability", label: "بدهکار" },
              { value: "receivable", label: "طلبکار" },
              { value: "overdue", label: "معوق" },
            ]}
          />
        </FilterField>
      </FilterBar>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <KpiCard
            label="بدهی سررسید"
            value={debtQ.isLoading ? "—" : formatToman(summary?.liabilitiesDue ?? 0)}
            tone="danger"
            icon={<FallOutlined />}
            hint={
              summary
                ? `${summary.liabilityCount} مورد · برآورد ${formatToman(summary.estimatedLiabilities)}`
                : undefined
            }
            size="sm"
          />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard
            label="طلب سررسید"
            value={debtQ.isLoading ? "—" : formatToman(summary?.receivablesDue ?? 0)}
            tone="success"
            icon={<RiseOutlined />}
            hint={
              summary
                ? `${summary.receivableCount} مورد · برآورد ${formatToman(summary.estimatedReceivables)}`
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
            label="معوق"
            value={debtQ.isLoading ? "—" : formatToman(summary?.overdueAmount ?? 0)}
            tone="warning"
            icon={<WarningOutlined />}
            hint={summary ? `${summary.overdueCount} مورد` : undefined}
            size="sm"
          />
        </Col>
      </Row>

      <SectionCard
        title="اقلام و برنامه تسویه"
        description="برای هر مورد، موعدهای آینده تا تسویه (یا پیش‌نمایش) را ببینید."
        extra={
          <Link href="/recurring">
            <Button size="small" icon={<AccountBookOutlined />}>
              سررسیدها
            </Button>
          </Link>
        }
      >
        {debtQ.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <Sk key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : null}

        {debtQ.error ? (
          <QueryError
            message="خطا در دریافت گزارش بدهی/طلب."
            onRetry={() => void debtQ.refetch()}
          />
        ) : null}

        {!debtQ.isLoading && !debtQ.error && items.length === 0 ? (
          <Flex vertical align="center" gap={8} className="py-8">
            <Text type="secondary">مورد فعالی برای این فیلتر نیست.</Text>
            <Link href="/recurring?new=1">
              <Button type="primary">ثبت بدهی یا طلب</Button>
            </Link>
          </Flex>
        ) : null}

        {!debtQ.isLoading && items.length > 0 ? (
          <Collapse
            bordered={false}
            className="bg-transparent [&_.ant-collapse-item]:mb-2 [&_.ant-collapse-item]:overflow-hidden [&_.ant-collapse-item]:rounded-2xl [&_.ant-collapse-item]:border [&_.ant-collapse-item]:border-app-border/60 [&_.ant-collapse-item]:bg-app-card [&_.ant-collapse-content-box]:!px-3 [&_.ant-collapse-content-box]:!pb-3 [&_.ant-collapse-header]:!items-center [&_.ant-collapse-header]:!px-3 [&_.ant-collapse-header]:!py-3"
            items={items.map((item) => ({
              key: item.id,
              label: (
                <Flex justify="space-between" align="flex-start" gap={12} className="w-full pe-2">
                  <div className="min-w-0">
                    <Flex align="center" gap={6} wrap="wrap" className="mb-1">
                      <Text strong className="!mb-0">
                        {item.title}
                      </Text>
                      <Tag
                        color={item.role === "liability" ? "red" : "green"}
                        className="!m-0"
                      >
                        {item.role === "liability" ? "بدهکار" : "طلبکار"}
                      </Tag>
                      {item.isOverdue ? (
                        <Tag color="orange" className="!m-0">
                          معوق
                        </Tag>
                      ) : null}
                    </Flex>
                    <Text type="secondary" className="text-xs">
                      {kindLabel(item)}
                      {item.category ? ` · ${item.category.name}` : ""}
                      {" · "}
                      {formatJalaliDate(item.nextPaymentDate)}
                      {" · "}
                      {dueLabel(item)}
                    </Text>
                  </div>
                  <div className="shrink-0 text-left">
                    <AmountText
                      tone={item.role === "liability" ? "expense" : "income"}
                      size="sm"
                    >
                      {formatToman(item.amount)}
                    </AmountText>
                    {item.estimatedRemaining != null &&
                    item.estimatedRemaining !== item.amount ? (
                      <div>
                        <Text type="secondary" className="text-[11px]">
                          مانده ≈ {formatToman(item.estimatedRemaining)}
                        </Text>
                      </div>
                    ) : null}
                  </div>
                </Flex>
              ),
              children: <ItemPlan item={item} />,
            }))}
          />
        ) : null}
      </SectionCard>
    </>
  );
}
