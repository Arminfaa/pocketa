"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  message?: string;
  onRetry?: () => void;
  className?: string;
};

export function QueryError({
  message = "خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.",
  onRetry,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-red-400/25 bg-red-500/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4",
        className
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
        <p className="text-sm text-[var(--muted)]">{message}</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-white/5 shrink-0"
        >
          تلاش مجدد
        </button>
      ) : null}
    </div>
  );
}
