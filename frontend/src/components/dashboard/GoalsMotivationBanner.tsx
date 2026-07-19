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
        "bg-gradient-to-l from-brand-500/16 via-brand-500/8 to-emerald-500/14",
        "dark:from-brand-500/20 dark:via-brand-500/10 dark:to-emerald-500/16"
      )}
      role="region"
      aria-label="پیشنهاد اهداف پس‌انداز"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-app-fg">
            <AimOutlined className="text-brand-600 dark:text-brand-300" />
            <span>سررسیدهای این ماه جمع شد</span>
          </div>
          <p className="text-[12px] leading-relaxed text-app-muted">
            با موجودی نقد فعلی ({formatToman(data.cash)}) می‌تونی روی این هدف‌ها قدم برداری.
          </p>
        </div>
        <Button
          type="text"
          size="small"
          shape="circle"
          className="!text-app-muted shrink-0"
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
              "bg-app-card/90 text-app-fg shadow-sm",
              "hover:bg-app-card active:scale-[0.99]"
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
            <div className="mt-2 text-[11px] text-app-muted">
              {goal.canComplete
                ? "می‌تونی کاملش کنی"
                : `پیشنهاد: بخشی از هدف (${toPersianDigits(goal.percent.toFixed(0))}٪ الان)`}
            </div>
            <div className="mt-1.5 text-sm font-bold tabular-nums text-brand-700 dark:text-brand-300">
              {formatToman(goal.suggestedAmount)}
            </div>
            <div className="mt-0.5 text-[11px] text-app-muted tabular-nums">
              مانده هدف: {formatToman(goal.remaining)}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
