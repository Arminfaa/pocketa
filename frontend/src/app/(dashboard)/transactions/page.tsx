"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsPage() {
  // Simple smoke-test query to ensure API wiring works.
  const q = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => (await api.get("/api/transactions?page=1&limit=10")).data.data,
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <div className="text-[var(--muted)]">خطا در دریافت تراکنش‌ها.</div>;

  return (
    <div className="text-[var(--muted)]">
      فعلاً فقط برای دمو نمایش داده می‌شود. تعداد تراکنش‌ها: {q.data.pagination.total}
    </div>
  );
}

