"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatToman } from "@/lib/format";

export default function BudgetsPage() {
  const q = useQuery({
    queryKey: ["budgets"],
    queryFn: async () => (await api.get("/api/budgets")).data.data,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <div className="text-[var(--muted)]">خطا در دریافت بودجه‌ها.</div>;

  const items = q.data?.items ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">بودجه‌بندی</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((b: any) => (
          <div key={b.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl" style={{ background: b.category?.color }} />
                <div className="font-medium">{b.category?.name}</div>
              </div>
              <div className="text-sm text-[var(--muted)]">
                مصرف: {formatToman(b.consumed)}
              </div>
            </div>
            <div className="mt-3 text-sm text-[var(--muted)]">
              سقف: {formatToman(b.amount)} - {b.percent.toFixed(0)}%
            </div>
            <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-500" style={{ width: `${b.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          بودجه‌ای برای این ماه ثبت نشده است.
        </div>
      ) : null}
    </div>
  );
}

