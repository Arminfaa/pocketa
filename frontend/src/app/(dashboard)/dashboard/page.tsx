"use client";

import Link from "next/link";
import api from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { App, Button, Flex, Typography } from "antd";
import {
  AccountBookOutlined,
  BellOutlined,
  FormOutlined,
  FundOutlined,
  ImportOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { QueryError } from "@/components/ui/query-error";
import { DashboardSkeleton } from "@/components/skeletons";
import { PageShell } from "@/components/ui/page-shell";
import { HeroBalanceCard } from "@/components/ui/hero-balance-card";
import { SectionCard } from "@/components/ui/section-card";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { AmountText } from "@/components/ui/amount-text";
import { EmptyState } from "@/components/ui/empty-state";
import { MarketPriceTicker } from "@/components/dashboard/MarketPriceTicker";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { enablePushNotifications, fetchPushStatus } from "@/lib/push";
import { formatTransactionDateTime } from "@/lib/transaction-time";
import { cn } from "@/lib/cn";

const { Text } = Typography;

type MarketPrices = {
  gold: {
    gram18kToman: number | null;
    gram24kToman: number | null;
    mesghal18kToman: number | null;
    mesghal24kToman: number | null;
    quarterCoinToman?: number | null;
    gram18kUsd: number;
    gram24kUsd: number;
    mesghal18kUsd: number;
    mesghal24kUsd: number;
    quarterCoinUsd?: number;
    fetchDate: string;
    fetchedAt: string;
  } | null;
  currency: {
    usdFreeToman: number;
    usdtToman: number;
    fetchDate: string;
    fetchedAt: string;
  } | null;
  asOfDate?: string;
  stale?: boolean;
  errors?: {
    gold?: string;
    currency?: string;
  };
};

type RecentWeekTx = {
  id: string;
  type: "income" | "expense";
  amount: number;
  title: string;
  date: string;
  time?: string;
  needsReview?: boolean;
  categoryName?: string;
};

const QUICK_LINKS = [
  {
    href: "/imports/bank-sms",
    label: "ایمپورت",
    icon: <ImportOutlined />,
  },
  {
    href: "/review",
    label: "نام‌گذاری",
    icon: <FormOutlined />,
  },
  {
    href: "/recurring",
    label: "سررسید‌ها",
    icon: <AccountBookOutlined />,
  },
  {
    href: "/investments",
    label: "سرمایه‌گذاری",
    icon: <FundOutlined />,
  },
  {
    href: "/budgets",
    label: "بودجه",
    icon: <WalletOutlined />,
  },
] as const;

export default function DashboardPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const dashboardQ = useQuery({
    queryKey: ["dashboard", selectedAccountId],
    queryFn: async () => {
      const qs = selectedAccountId ? `?accountId=${selectedAccountId}` : "";
      return (await api.get(`/api/dashboard${qs}`)).data.data as {
        totals: {
          balance: number;
          incomeThisMonth: number;
          expenseThisMonth: number;
          savingsPercent: number;
        };
        netWorth: {
          cash: number;
          investmentsValue: number;
          liabilities: number;
          receivables: number;
          netWorth: number;
        } | null;
        recentWeek: {
          from: string;
          to: string;
          items: RecentWeekTx[];
        };
      };
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
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.stale ? 2 * 60_000 : false),
    retry: 1,
  });

  const dashboardReady = dashboardQ.isSuccess;

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

  const recentItems = dashboard?.recentWeek?.items ?? [];

  return (
    <PageShell width="full">
      <MarketPriceTicker
        market={market}
        loading={marketQ.isLoading}
        errorMessage={tickerError}
      />

      {showPushPrompt ? (
        <SectionCard>
          <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
            <div className="min-w-0">
              <Text strong>
                <BellOutlined className="me-1 text-brand-500" />
                یادآوری پوش
              </Text>
              <div>
                <Text type="secondary" className="text-xs">
                  از ۳ روز قبل موعد بدهی/قسط، در ساعت مشخص‌شده نوتیف می‌آید. خاموش کردن از تنظیمات.
                </Text>
              </div>
            </div>
            <Button
              type="primary"
              icon={<BellOutlined />}
              loading={pushMutation.isPending}
              onClick={() => pushMutation.mutate()}
            >
              فعال‌سازی روی این دستگاه
            </Button>
          </Flex>
        </SectionCard>
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
          <HeroBalanceCard
            balance={formatToman(dashboard.totals.balance)}
            hint={`پس‌انداز عملیاتی این ماه: ${dashboard.totals.savingsPercent.toFixed(1)}٪`}
            incomeValue={formatToman(dashboard.totals.incomeThisMonth)}
            expenseValue={formatToman(dashboard.totals.expenseThisMonth)}
          />

          {dashboard.netWorth && !selectedAccountId ? (
            <SectionCard
              title="ارزش خالص"
              description="نقد + سرمایه‌گذاری − بدهی + طلب (سررسیدهای فعال)"
            >
              <SoftList className="!shadow-none !rounded-2xl bg-brand-500/[0.05] dark:bg-brand-500/[0.08]">
                {[
                  { label: "نقد", value: dashboard.netWorth.cash, tone: "default" as const },
                  {
                    label: "سرمایه‌گذاری",
                    value: dashboard.netWorth.investmentsValue,
                    tone: "violet" as const,
                  },
                  {
                    label: "بدهی‌ها",
                    value: dashboard.netWorth.liabilities,
                    tone: "expense" as const,
                  },
                  {
                    label: "طلب‌ها",
                    value: dashboard.netWorth.receivables,
                    tone: "income" as const,
                  },
                  {
                    label: "ارزش خالص",
                    value: dashboard.netWorth.netWorth,
                    tone: "brand" as const,
                  },
                ].map((row) => (
                  <SoftListItem key={row.label}>
                    <SoftListRow
                      title={
                        <span className={row.tone === "brand" ? "text-brand-600" : undefined}>
                          {row.label}
                        </span>
                      }
                      trailing={
                        <AmountText
                          tone={
                            row.tone === "violet"
                              ? "brand"
                              : row.tone === "expense"
                                ? "expense"
                                : row.tone === "income"
                                  ? "income"
                                  : row.tone === "brand"
                                    ? "brand"
                                    : "default"
                          }
                          size={row.tone === "brand" ? "md" : "sm"}
                        >
                          {formatToman(row.value)}
                        </AmountText>
                      }
                    />
                  </SoftListItem>
                ))}
              </SoftList>
            </SectionCard>
          ) : null}

          <SectionCard title="دسترسی سریع" description="میانبر بخش‌های پرتکرار">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-8">
              {QUICK_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors",
                    "bg-[color-mix(in_srgb,var(--muted)_7%,transparent)] text-app-fg",
                    "hover:bg-brand-500/10 active:bg-brand-500/14"
                  )}
                >
                  <span className="text-xl leading-none text-brand-600 dark:text-brand-300">
                    {item.icon}
                  </span>
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>

          <SoftList
            header={
              <Flex justify="space-between" align="center" gap="small" wrap="wrap">
                <div>
                  <Text strong>تراکنش‌های هفته اخیر</Text>
                  <div>
                    <Text type="secondary" className="text-xs">
                      {formatJalaliDate(dashboard.recentWeek.from)} تا{" "}
                      {formatJalaliDate(dashboard.recentWeek.to)}
                    </Text>
                  </div>
                </div>
                <Link
                  href="/transactions"
                  className="text-xs font-medium text-brand-600 dark:text-brand-300"
                >
                  مشاهده همه
                </Link>
              </Flex>
            }
          >
            {recentItems.length === 0 ? (
              <div className="px-2 py-4">
                <EmptyState
                  title="تراکنشی در این هفته نیست"
                  description="با افزودن تراکنش یا ایمپورت بانکی اینجا پر می‌شود."
                />
              </div>
            ) : (
              recentItems.map((tx) => (
                <SoftListItem key={tx.id}>
                  <SoftListRow
                    title={
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span>{tx.title || "بدون عنوان"}</span>
                        {tx.needsReview ? (
                          <span className="rounded-lg bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                            نام‌گذاری
                          </span>
                        ) : null}
                      </span>
                    }
                    subtitle={
                      <>
                        {formatTransactionDateTime(
                          formatJalaliDate(tx.date),
                          tx.time || undefined
                        )}
                        {tx.categoryName ? ` · ${tx.categoryName}` : ""}
                      </>
                    }
                    trailing={
                      <AmountText
                        tone={tx.type === "income" ? "income" : "expense"}
                        size="sm"
                        prefix={tx.type === "income" ? "+" : "-"}
                      >
                        {formatToman(tx.amount)}
                      </AmountText>
                    }
                  />
                </SoftListItem>
              ))
            )}
          </SoftList>
        </>
      ) : null}
    </PageShell>
  );
}
