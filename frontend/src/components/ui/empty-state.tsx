"use client";

import type { ReactNode } from "react";
import { InboxOutlined } from "@ant-design/icons";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description?: string;
  /** retained for call-site compatibility */
  icon?: unknown;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-500/10 text-2xl text-brand-500">
        <InboxOutlined />
      </div>
      <div className="text-base font-semibold text-app-fg">{title}</div>
      {description ? (
        <div className="max-w-sm text-sm text-app-muted leading-relaxed">{description}</div>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
