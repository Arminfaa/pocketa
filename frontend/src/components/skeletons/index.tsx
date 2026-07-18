"use client";

import { Card, Col, Flex, Row } from "antd";
import { Sk } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

function StatCardSkeleton() {
  return (
    <Card>
      <Sk className="mb-3 h-3 w-24" />
      <Sk className="h-7 w-36" />
    </Card>
  );
}

/** Shared KPI cards row — responsive Col props match real Statistic grids. */
export function KpiRowSkeleton({
  count,
  colProps,
  gutter = [12, 12] as [number, number],
}: {
  count: number;
  colProps: { xs?: number; sm?: number; md?: number; lg?: number };
  gutter?: [number, number];
}) {
  return (
    <Row gutter={gutter} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} {...colProps}>
          <StatCardSkeleton />
        </Col>
      ))}
    </Row>
  );
}

function ChartCardSkeleton({
  titleWidth = "40%",
  className,
}: {
  titleWidth?: string;
  className?: string;
}) {
  return (
    <Card
      title={<Sk className="h-4" style={{ width: titleWidth }} />}
      className={className}
    >
      <Sk className="h-[300px] w-full rounded-2xl md:h-[260px]" />
    </Card>
  );
}

/** Dashboard content placeholder — matches hero + section cards. */
export function DashboardSkeleton() {
  return (
    <div className="w-full space-y-4" aria-busy="true">
      <div className="surface-card space-y-4 p-5 sm:p-6">
        <Sk className="mx-auto h-3 w-24 sm:mx-0" />
        <Sk className="mx-auto h-10 w-56 sm:mx-0" />
        <Sk className="mx-auto h-3 w-40 sm:mx-0" />
        <div className="grid grid-cols-2 gap-3">
          <Sk className="h-16 w-full rounded-2xl" />
          <Sk className="h-16 w-full rounded-2xl" />
        </div>
        <Sk className="h-12 w-full rounded-2xl" />
      </div>
      <div className="surface-card space-y-3 p-4 sm:p-5">
        <Sk className="h-4 w-32" />
        <Sk className="h-3 w-full" />
        <Sk className="h-3 w-5/6" />
        <Sk className="h-3 w-2/3" />
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ChartCardSkeleton titleWidth="55%" />
        </Col>
        <Col xs={24} lg={12}>
          <ChartCardSkeleton titleWidth="45%" />
        </Col>
      </Row>
    </div>
  );
}

/** Initial auth gate — mirrors AppLayout chrome, not a random dashboard. */
export function AppShellSkeleton() {
  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-app-surface" aria-busy="true">
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-[268px] shrink-0 border-l border-app-border bg-app-card p-4 lg:flex lg:flex-col lg:gap-4">
        <div className="flex items-center gap-3 px-1 py-2">
          <Sk className="h-10 w-10 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Sk className="h-4 w-24" />
            <Sk className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-2 px-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Sk key={i} className="h-10 w-full rounded-2xl" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-app-border bg-app-card/90 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3 lg:hidden">
            <Sk className="h-9 w-9 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Sk className="h-4 w-28" />
              <Sk className="h-3 w-36" />
            </div>
            <Sk className="h-9 w-9 shrink-0 rounded-full" />
          </div>
          <div className="mt-3 lg:mt-0">
            <Sk className="hidden h-10 w-44 rounded-2xl lg:block" />
            <Sk className="h-10 w-full rounded-2xl lg:hidden" />
          </div>
        </header>

        <main className="flex-1 space-y-4 overflow-hidden p-3 sm:p-4 md:p-6">
          <div className="flex items-center gap-3">
            <Sk className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Sk className="h-5 w-40" />
              <Sk className="h-3 w-56 max-w-full" />
            </div>
          </div>
          <div className="surface-card space-y-4 p-5">
            <Sk className="h-3 w-24" />
            <Sk className="h-10 w-48" />
            <div className="grid grid-cols-2 gap-3">
              <Sk className="h-16 rounded-2xl" />
              <Sk className="h-16 rounded-2xl" />
            </div>
            <Sk className="h-12 rounded-2xl" />
          </div>
          <div className="surface-card space-y-3 p-4">
            <Sk className="h-4 w-1/3" />
            <Sk className="h-3 w-full" />
            <Sk className="h-3 w-5/6" />
            <Sk className="h-3 w-2/3" />
          </div>
        </main>
      </div>
    </div>
  );
}

/** Transactions list: mobile cards vs desktop table. */
export function TransactionsListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full" aria-busy="true">
      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        <Sk className="mb-1 h-5 w-40" />
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} size="small">
            <Flex justify="space-between" align="flex-start" gap="middle">
              <Flex align="flex-start" gap="small" className="min-w-0 flex-1">
                <Sk className="mt-1 h-4 w-4 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Sk className="h-4 w-3/4" />
                  <Sk className="h-3 w-full max-w-[14rem]" />
                </div>
              </Flex>
              <Sk className="h-4 w-20 shrink-0" />
            </Flex>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Sk className="h-9 w-full rounded-lg" />
              <Sk className="h-9 w-full rounded-lg" />
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block" classNames={{ body: "!p-0" }}>
        <div className="border-b border-app-border px-4 py-3">
          <div className="grid grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Sk key={i} className="h-3 w-full" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-app-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 items-center gap-3 px-4 py-3.5">
              {Array.from({ length: 8 }).map((_, j) => (
                <Sk
                  key={j}
                  className={cn("h-3.5", j === 1 ? "w-4/5" : "w-full")}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Accounts list cards — stacked actions on mobile. */
export function AccountsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} classNames={{ body: "p-4" }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sk className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Sk className="h-4 w-32" />
                <Sk className="h-3 w-24" />
              </div>
            </div>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <div className="me-auto space-y-1 md:me-2">
                <Sk className="h-2.5 w-10" />
                <Sk className="h-4 w-24" />
              </div>
              <Sk className="h-8 w-8 shrink-0 rounded-lg" />
              <Sk className="h-8 w-8 shrink-0 rounded-lg" />
              <Sk className="h-8 w-8 shrink-0 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Categories grid: 1 col mobile / 2 cols md+. */
export function CategoriesListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Row gutter={[12, 12]} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} xs={24} md={12}>
          <Card classNames={{ body: "p-4" }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Sk className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Sk className="h-4 w-28" />
                  <Sk className="h-5 w-16 rounded-full" />
                </div>
              </div>
              <div className="flex gap-2">
                <Sk className="h-8 w-8 rounded-lg" />
                <Sk className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/** Budgets cards with progress (KPI row separate via KpiRowSkeleton). */
export function BudgetsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Row gutter={[12, 12]} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Col key={i} xs={24} md={12}>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Sk className="h-7 w-7 shrink-0 rounded-xl" />
                <Sk className="h-4 w-28" />
              </div>
              <Sk className="h-8 w-8 rounded-lg" />
            </div>
            <div className="mb-2 flex justify-between gap-2">
              <Sk className="h-3 w-24" />
              <Sk className="h-3 w-24" />
            </div>
            <Sk className="mb-2 h-3 w-40" />
            <Sk className="mt-2 h-2 w-full rounded-full" />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/** Goals full-width cards (KPI row separate via KpiRowSkeleton). */
export function GoalsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Sk className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Sk className="h-4 w-36" />
                <Sk className="h-3 w-48 max-w-full" />
              </div>
            </div>
            <Sk className="h-8 w-8 shrink-0 rounded-lg" />
          </div>
          <Sk className="h-2 w-full rounded-full" />
          <Sk className="mt-2 h-3 w-40" />
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Sk className="h-9 w-full flex-1 rounded-lg" />
            <Sk className="h-9 w-full rounded-lg md:w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Recurring / سررسید list cards. */
export function RecurringListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="w-full space-y-3" aria-busy="true">
      <Card>
        <Sk className="mb-3 h-4 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg bg-app-muted/10 px-2 py-2"
            >
              <Sk className="h-4 w-40 max-w-[55%]" />
              <Sk className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Sk className="h-4 w-32" />
                <Sk className="h-5 w-16 rounded-full" />
              </div>
              <Sk className="h-3 w-full max-w-md" />
            </div>
            <Sk className="h-5 w-24 shrink-0 self-start md:self-auto" />
          </div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <Sk className="h-9 w-full rounded-lg md:w-40" />
            <Sk className="h-9 w-full rounded-lg md:w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Reports chart + optional monthly extras. */
export function ReportsChartsSkeleton({
  mode,
}: {
  mode: "monthly" | "range";
}) {
  return (
    <div className="w-full space-y-4" aria-busy="true">
      <ChartCardSkeleton titleWidth="50%" />
      {mode === "monthly" ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <ChartCardSkeleton titleWidth="40%" />
            </Col>
            <Col xs={24} lg={12}>
              <ChartCardSkeleton titleWidth="40%" />
            </Col>
          </Row>
          <Card title={<Sk className="h-4 w-36" />}>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 border-b border-app-border py-2 last:border-0"
                >
                  <Sk className="h-3.5 w-28" />
                  <Sk className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

/** Investments asset cards (KPI row separate). */
export function InvestmentsListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="w-full space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} title={<Sk className="h-4 w-40" />}>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between gap-3">
                <Sk className="h-3 w-24" />
                <Sk className="h-3.5 w-28" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Import review naming cards. */
export function ReviewListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="w-full max-w-3xl space-y-3" aria-busy="true">
      <Card size="small">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Sk className="h-5 w-36" />
          <Sk className="h-9 w-44 rounded-lg" />
        </div>
      </Card>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} title={<Sk className="h-4 w-40" />}>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <Sk className="h-3 w-48 max-w-full" />
                <Sk className="h-3 w-32" />
              </div>
              <Sk className="h-5 w-24" />
            </div>
            <Sk className="h-9 w-full rounded-lg" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <Sk className="h-9 w-full rounded-lg md:col-span-3" />
              <Sk className="h-9 w-full rounded-lg md:col-span-2" />
            </div>
            <Sk className="h-4 w-48" />
            <Sk className="h-9 w-full rounded-lg md:w-48" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Settings profile/push cards. */
export function SettingsSkeleton() {
  return (
    <div className="w-full max-w-xl space-y-4" aria-busy="true">
      <Card title={<Sk className="h-4 w-24" />}>
        <div className="space-y-3">
          <Sk className="h-3 w-40" />
          <Sk className="h-3 w-52" />
          <Sk className="h-9 w-full rounded-lg" />
          <Sk className="h-9 w-28 rounded-lg" />
        </div>
      </Card>
      <Card title={<Sk className="h-4 w-28" />}>
        <div className="space-y-3">
          <Sk className="h-3 w-full" />
          <Sk className="h-3 w-2/3" />
          <div className="flex flex-wrap gap-2">
            <Sk className="h-6 w-20 rounded-full" />
            <Sk className="h-9 w-36 rounded-lg" />
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Asset calculator loading card. */
export function AssetCalculatorSkeleton() {
  return (
    <Card aria-busy="true">
      <div className="space-y-4">
        <Sk className="h-9 w-full rounded-lg" />
        <Sk className="h-3 w-40" />
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Sk className="mb-2 h-3 w-24" />
            <Sk className="h-9 w-full rounded-lg" />
          </Col>
          <Col xs={24} sm={12}>
            <Sk className="mb-2 h-3 w-24" />
            <Sk className="h-9 w-full rounded-lg" />
          </Col>
        </Row>
      </div>
    </Card>
  );
}

/** Market ticker strip placeholder. */
export function TickerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "market-ticker flex items-center gap-3 overflow-hidden px-3 py-2.5",
        className
      )}
      aria-busy="true"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex shrink-0 items-baseline gap-1.5 rounded-xl px-3 py-1"
          style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
        >
          <Sk className="h-3 w-16" />
          <Sk className="h-4 w-20" />
          <Sk className="h-2.5 w-8" />
        </div>
      ))}
    </div>
  );
}
