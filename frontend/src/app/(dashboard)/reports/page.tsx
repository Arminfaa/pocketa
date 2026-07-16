"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { formatToman } from "@/lib/format";

export default function ReportsPage() {
  const q = useQuery({
    queryKey: ["reports-monthly"],
    queryFn: async () => (await api.get("/api/reports/monthly?months=6")).data.data,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <div className="text-[var(--muted)]">خطا در دریافت گزارش‌ها.</div>;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-[var(--text)]">گزارش‌ها</h1>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="text-[var(--muted)] text-sm mb-2">خلاصه درآمد و هزینه (۶ ماه اخیر)</div>
        <div className="space-y-2">
          {q.data.labels.map((label: string, i: number) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <div className="text-[var(--muted)]">{label}</div>
              <div className="flex gap-3">
                <div className="text-brand-500">{formatToman(q.data.income[i])}</div>
                <div className="text-violet-500">{formatToman(q.data.expense[i])}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

