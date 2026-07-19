"use client";

import Link from "next/link";
import { AccountBookOutlined } from "@ant-design/icons";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

export type DueBannerItem = {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  kind: "recurring" | "one_time";
  dueDate: string;
  daysUntil: number;
};

function dueStatusLabel(daysUntil: number): string {
  if (daysUntil > 1) return `${toPersianDigits(String(daysUntil))} روز مانده`;
  if (daysUntil === 1) return "فردا سررسید";
  if (daysUntil === 0) return "امروز سررسید";
  if (daysUntil === -1) return `${toPersianDigits("1")} روز از موعد گذشته`;
  return `${toPersianDigits(String(Math.abs(daysUntil)))} روز از موعد گذشته`;
}

function kindLabel(item: DueBannerItem): string {
  if (item.type === "income") return "طلب";
  return item.kind === "one_time" ? "بدهی" : "قسط";
}

type Props = {
  items: DueBannerItem[];
};

export function DueBanners({ items }: Props) {
  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-2" role="region" aria-label="یادآوری سررسیدها">
      {items.map((item) => {
        const overdue = item.daysUntil < 0;
        const dueToday = item.daysUntil === 0;
        const receivable = item.type === "income";

        return (
          <Link
            key={item.id}
            href="/recurring"
            className={cn(
              "flex items-start gap-3 rounded-2xl px-3.5 py-3 transition-colors",
              "border-0 no-underline",
              overdue
                ? "bg-rose-500/12 text-rose-900 hover:bg-rose-500/18 dark:bg-rose-500/15 dark:text-rose-100 dark:hover:bg-rose-500/22"
                : dueToday
                  ? "bg-amber-500/14 text-amber-950 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:text-amber-50 dark:hover:bg-amber-500/22"
                  : receivable
                    ? "bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/18 dark:bg-emerald-500/14 dark:text-emerald-50 dark:hover:bg-emerald-500/20"
                    : "bg-brand-500/12 text-brand-950 hover:bg-brand-500/18 dark:bg-brand-500/14 dark:text-brand-50 dark:hover:bg-brand-500/20"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base",
                overdue
                  ? "bg-rose-500/20 text-rose-700 dark:text-rose-200"
                  : dueToday
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-100"
                    : receivable
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-100"
                      : "bg-brand-500/20 text-brand-700 dark:text-brand-100"
              )}
              aria-hidden
            >
              <AccountBookOutlined />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="truncate text-sm font-semibold">{item.title}</span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {formatToman(item.amount)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-90">
                <span className="font-medium">{dueStatusLabel(item.daysUntil)}</span>
                <span aria-hidden>·</span>
                <span>{kindLabel(item)}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{formatJalaliDate(item.dueDate)}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
