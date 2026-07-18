"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "brand" | "success" | "danger" | "warning" | "violet";

const TONE: Record<
  Tone,
  { shell: string; icon: string; value: string }
> = {
  default: {
    shell: "bg-app-card",
    icon: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    value: "text-app-fg",
  },
  brand: {
    shell: "bg-gradient-to-b from-white to-brand-50/70 dark:from-app-card dark:to-brand-500/10",
    icon: "bg-brand-500/12 text-brand-600 dark:text-brand-300",
    value: "text-brand-600 dark:text-brand-300",
  },
  success: {
    shell: "bg-gradient-to-b from-white to-emerald-50/70 dark:from-app-card dark:to-emerald-500/10",
    icon: "bg-emerald-500/12 text-emerald-600",
    value: "text-emerald-600",
  },
  danger: {
    shell: "bg-gradient-to-b from-white to-red-50/70 dark:from-app-card dark:to-red-500/10",
    icon: "bg-red-500/12 text-red-500",
    value: "text-red-500",
  },
  warning: {
    shell: "bg-gradient-to-b from-white to-amber-50/70 dark:from-app-card dark:to-amber-500/10",
    icon: "bg-amber-500/12 text-amber-600",
    value: "text-amber-600",
  },
  violet: {
    shell: "bg-gradient-to-b from-white to-violet-50/70 dark:from-app-card dark:to-brandViolet-500/10",
    icon: "bg-brandViolet-500/12 text-brandViolet-600 dark:text-brandViolet-400",
    value: "text-brandViolet-600 dark:text-brandViolet-400",
  },
};

type Props = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function KpiCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
  className,
  size = "md",
}: Props) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "surface-card flex h-full flex-col gap-2 p-4 sm:p-5",
        t.shell,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-app-muted">{label}</div>
        {icon ? (
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base",
              t.icon
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "font-bold tabular-nums tracking-tight leading-none",
          size === "lg" && "text-3xl sm:text-4xl",
          size === "md" && "text-xl sm:text-2xl",
          size === "sm" && "text-lg",
          t.value
        )}
      >
        {value}
      </div>
      {hint ? <div className="text-[11px] text-app-muted leading-relaxed">{hint}</div> : null}
    </div>
  );
}
