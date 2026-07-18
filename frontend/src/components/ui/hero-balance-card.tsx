"use client";

import type { ReactNode } from "react";
import { Button } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, PlusOutlined } from "@ant-design/icons";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  label?: ReactNode;
  balance: ReactNode;
  hint?: ReactNode;
  incomeLabel?: ReactNode;
  incomeValue: ReactNode;
  expenseLabel?: ReactNode;
  expenseValue: ReactNode;
  ctaHref?: string;
  ctaLabel?: ReactNode;
  className?: string;
};

export function HeroBalanceCard({
  label = "موجودی کل",
  balance,
  hint,
  incomeLabel = "درآمد",
  incomeValue,
  expenseLabel = "هزینه",
  expenseValue,
  ctaHref = "/transactions?new=1",
  ctaLabel = "تراکنش جدید",
  className,
}: Props) {
  return (
    <section
      className={cn(
        "surface-card relative overflow-hidden p-5 sm:p-6",
        "bg-gradient-to-b from-white via-brand-50/40 to-brandViolet-500/5",
        "dark:from-app-card dark:via-brand-500/10 dark:to-brandViolet-500/10",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -start-10 -top-16 h-40 w-40 rounded-full bg-brand-400/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-8 bottom-0 h-32 w-32 rounded-full bg-brandViolet-500/15 blur-3xl"
      />

      <div className="relative flex flex-col gap-5 text-center sm:text-start">
        <div>
          <div className="text-sm text-app-muted">{label}</div>
          <div className="mt-1.5 text-3xl font-bold tracking-tight text-brand-600 tabular-nums dark:text-brand-300 sm:text-4xl">
            {balance}
          </div>
          {hint ? <div className="mt-1.5 text-xs text-app-muted">{hint}</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-500/10 px-3 py-3 text-start backdrop-blur-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
              <ArrowDownOutlined />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-app-muted">{incomeLabel}</div>
              <div className="font-bold tabular-nums text-emerald-600">{incomeValue}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl bg-red-500/10 px-3 py-3 text-start backdrop-blur-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <ArrowUpOutlined />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-app-muted">{expenseLabel}</div>
              <div className="font-bold tabular-nums text-red-500">{expenseValue}</div>
            </div>
          </div>
        </div>

        {ctaHref ? (
          <Link href={ctaHref} className="block">
            <Button
              type="primary"
              size="large"
              block
              icon={<PlusOutlined />}
              className="!h-12 !rounded-2xl !font-semibold"
            >
              {ctaLabel}
            </Button>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
