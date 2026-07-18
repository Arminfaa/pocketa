"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SoftListProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
};

/** Soft elevated list — spacing instead of hard dividers. */
export function SoftList({ children, className, header }: SoftListProps) {
  return (
    <div className={cn("surface-card overflow-hidden", className)}>
      {header ? (
        <div className="bg-brand-500/[0.05] px-4 py-3 dark:bg-brand-500/[0.08] sm:px-5">
          {header}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5 p-1.5 sm:p-2">{children}</div>
    </div>
  );
}

type SoftListItemProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function SoftListItem({ children, className, onClick }: SoftListItemProps) {
  const interactive = Boolean(onClick);
  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-3 transition-colors sm:px-3.5",
        interactive && "cursor-pointer hover:bg-brand-500/[0.05] active:bg-brand-500/[0.08]",
        className
      )}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {children}
    </div>
  );
}

type SoftListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function SoftListRow({
  leading,
  title,
  subtitle,
  trailing,
  footer,
  className,
}: SoftListRowProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {leading}
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="text-[15px] font-semibold text-app-fg leading-snug">{title}</div>
            {subtitle ? (
              <div className="mt-1 text-xs text-app-muted leading-relaxed">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {trailing ? (
          <div className="shrink-0 pt-0.5 text-left tabular-nums">{trailing}</div>
        ) : null}
      </div>
      {footer ? (
        <div className={cn("mt-3", leading ? "ps-[3.25rem]" : undefined)}>{footer}</div>
      ) : null}
    </div>
  );
}

type SoftAvatarProps = {
  color?: string;
  children?: ReactNode;
  className?: string;
};

export function SoftAvatar({ color, children, className }: SoftAvatarProps) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base text-white shadow-sm",
        !color && "bg-brand-500",
        className
      )}
      style={color ? { background: color } : undefined}
    >
      {children}
    </div>
  );
}
