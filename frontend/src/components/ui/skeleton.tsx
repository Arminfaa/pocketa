"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/** Single pulse block — building piece for page skeletons. */
export function Sk({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={cn("sk-block", className)} style={style} aria-hidden />;
}

/**
 * Legacy multi-row skeleton.
 * Prefer page skeletons + `Sk` for layout-faithful placeholders.
 */
export function Skeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("w-full space-y-3", className)} aria-busy="true" aria-hidden>
      <Sk className="h-4 w-[40%]" />
      {Array.from({ length: rows }).map((_, i) => (
        <Sk
          key={i}
          className={cn("h-3", i === rows - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
