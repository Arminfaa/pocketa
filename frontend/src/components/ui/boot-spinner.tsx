"use client";

import { Spin } from "antd";

/** Full-viewport boot spinner — used before the authenticated shell/skeletons. */
export function BootSpinner({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div
      className="flex h-dvh max-h-dvh w-full flex-col items-center justify-center gap-3 bg-app-surface"
      aria-busy="true"
      aria-live="polite"
    >
      <Spin size="large" />
      <span className="text-xs text-app-muted">{label}</span>
    </div>
  );
}
