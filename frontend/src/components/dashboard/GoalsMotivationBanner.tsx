"use client";

import Link from "next/link";
import { AimOutlined, CloseOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useGoalsMotivationDismissStore } from "@/stores/goals-motivation-dismiss.store";

export type GoalsMotivationGoal = {
  id: string;
  title: string;
  remaining: number;
  percent: number;
  suggestedAmount: number;
  canComplete: boolean;
  color: string;
};

export type GoalsMotivationData = {
  eligible: boolean;
  monthLabel: string;
  cash: number;
  goals: GoalsMotivationGoal[];
};

type Props = {
  data?: GoalsMotivationData | null;
};

export function GoalsMotivationBanner({ data }: Props) {
  const dismissForMonth = useGoalsMotivationDismissStore((s) => s.dismissForMonth);
  const isDismissedForMonth = useGoalsMotivationDismissStore((s) => s.isDismissedForMonth);

  if (!data?.eligible || !data.goals.length) return null;
  if (isDismissedForMonth(data.monthLabel)) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl",
        // Light: stronger tinted wash so it doesn't melt into white page bg
        "bg-gradient-to-l from-cyan-500/18 via-teal-500/14 to-emerald-500/16",
        "ring-1 ring-inset ring-cyan-600/15",
        "shadow-[0_10px_28px_rgba(8,145,178,0.10)]",
        // Dark: keep the softer glow that already reads well
        "dark:from-brand-500/22 dark:via-brand-500/12 dark:to-emerald-500/18",
        "dark:ring-brand-400/20 dark:shadow-none"
      )}
      role="region"
      aria-label="پیشنهاد اهداف پس‌انداز"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-app-fg">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-700 dark:bg-brand-500/25 dark:text-brand-200">
              <AimOutlined />
            </span>
            <span>سررسیدهای این ماه جمع شد</span>
          </div>
          <p className="text-[12px] leading-relaxed text-slate-600 dark:text-app-muted">
            با موجودی نقد فعلی ({formatToman(data.cash)}) می‌تونی روی این هدف‌ها قدم برداری.
          </p>
        </div>
        <Button
          type="text"
          size="small"
          shape="circle"
          className="!text-slate-500 hover:!bg-white/60 dark:!text-app-muted dark:hover:!bg-white/10 shrink-0"
          icon={<CloseOutlined />}
          aria-label="بستن پیشنهاد اهداف"
          onClick={() => dismissForMonth(data.monthLabel)}
        />
      </div>

      <div
        className="flex gap-2.5 overflow-x-auto px-4 pb-3.5 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {data.goals.map((goal) => (
          <Link
            key={goal.id}
            href="/goals"
            className={cn(
              "snap-start shrink-0 w-[min(78vw,16.5rem)] rounded-2xl px-3.5 py-3 no-underline transition-colors",
              // Light: opaque white chips on tinted shell for clear separation
              "bg-white text-slate-900 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/6",
              "hover:bg-white hover:shadow-[0_8px_22px_rgba(15,23,42,0.12)]",
              // Dark: soft card surface
              "dark:bg-app-card/90 dark:text-app-fg dark:shadow-sm dark:ring-white/8",
              "dark:hover:bg-app-card",
              "active:scale-[0.99]"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: goal.color }}
                aria-hidden
              />
              <span className="truncate text-sm font-semibold">{goal.title}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-app-muted">
              {goal.canComplete
                ? "می‌تونی کاملش کنی"
                : `پیشنهاد: بخشی از هدف (${toPersianDigits(goal.percent.toFixed(0))}٪ الان)`}
            </div>
            <div className="mt-1.5 text-sm font-bold tabular-nums text-cyan-700 dark:text-brand-300">
              {formatToman(goal.suggestedAmount)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-app-muted tabular-nums">
              مانده هدف: {formatToman(goal.remaining)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
