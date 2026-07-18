"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  tone?: "default" | "income" | "expense" | "brand" | "muted";
  size?: "sm" | "md" | "lg";
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
  caption?: ReactNode;
};

const TONE = {
  default: "text-app-fg",
  income: "text-emerald-600",
  expense: "text-red-500",
  brand: "text-brand-600 dark:text-brand-300",
  muted: "text-app-muted",
} as const;

const SIZE = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg sm:text-xl",
} as const;

export function AmountText({
  children,
  tone = "default",
  size = "md",
  prefix,
  suffix,
  className,
  caption,
}: Props) {
  return (
    <div className={cn("text-left", className)}>
      <div className={cn("font-bold tabular-nums leading-tight", TONE[tone], SIZE[size])}>
        {prefix}
        {children}
        {suffix}
      </div>
      {caption ? (
        <div className="mt-0.5 text-[11px] text-app-muted leading-none">{caption}</div>
      ) : null}
    </div>
  );
}
