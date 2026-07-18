"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Soft filter/control strip under page headers. */
export function FilterBar({ children, className }: Props) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

type FilterFieldProps = {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <label className={cn("flex min-w-[8rem] flex-1 flex-col gap-1.5", className)}>
      {label ? <span className="text-xs font-medium text-app-muted">{label}</span> : null}
      {children}
    </label>
  );
}
