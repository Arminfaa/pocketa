"use client";

import { Skeleton as AntSkeleton } from "antd";

/** Drop-in loading placeholder used across pages. */
export function Skeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={className}>
      <AntSkeleton active paragraph={{ rows }} title={{ width: "40%" }} />
    </div>
  );
}
