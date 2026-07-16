"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesPage() {
  const q = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get("/api/categories")).data.data,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <div className="text-[var(--muted)]">خطا در دریافت دسته‌بندی‌ها.</div>;

  const items = q.data?.items ?? [];
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-[var(--text)]">دسته‌بندی‌ها</h1>
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c: any) => (
          <div key={c._id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between">
              <div className="font-medium">{c.name}</div>
              <div className="h-7 w-7 rounded-xl" style={{ background: c.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

