"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
};

/** Soft titled panel used for charts, forms, and grouped content. */
export function SectionCard({
  title,
  description,
  extra,
  children,
  className,
  bodyClassName,
  flush,
}: Props) {
  const hasHead = Boolean(title || description || extra);
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {hasHead ? (
        <div className="flex items-start justify-between gap-3 border-b border-app-border/50 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="m-0 text-[15px] font-semibold text-app-fg leading-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="m-0 mt-1 text-xs text-app-muted leading-relaxed">{description}</p>
            ) : null}
          </div>
          {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
      ) : null}
      <div className={cn(flush ? "p-0" : "p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
