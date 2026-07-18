"use client";

import type { ReactNode } from "react";
import { Card } from "antd";
import { cn } from "@/lib/cn";

type SoftListProps = {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
};

/** Single elevated card with divided rows — modern finance-app list. */
export function SoftList({ children, className, header }: SoftListProps) {
  return (
    <Card
      className={cn("!overflow-hidden", className)}
      styles={{ body: { padding: 0 } }}
    >
      {header ? (
        <div className="border-b border-app-border/60 px-3 py-2.5 sm:px-4">
          {header}
        </div>
      ) : null}
      <div className="divide-y divide-app-border/50">{children}</div>
    </Card>
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
        "px-3 py-3 sm:px-4",
        interactive && "cursor-pointer transition-colors hover:bg-brand-500/5 active:bg-brand-500/8",
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
  /** Leading visual (icon chip) — sits on the start side in RTL (right) */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Trailing value — sits on the end side in RTL (left) */
  trailing?: ReactNode;
  /** Optional actions under the main row */
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
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-app-fg leading-snug">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 text-xs text-app-muted leading-relaxed">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {trailing ? (
          <div className="shrink-0 text-left tabular-nums">{trailing}</div>
        ) : null}
      </div>
      {footer ? (
        <div className={cn("mt-2.5", leading ? "ps-[3.25rem]" : undefined)}>{footer}</div>
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
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white",
        className
      )}
      style={color ? { background: color } : undefined}
    >
      {children}
    </div>
  );
}
