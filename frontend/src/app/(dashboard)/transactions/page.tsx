"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { formatToman } from "@/lib/format";

export default function TransactionsPage() {
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const q = useQuery({
    queryKey: ["transactions", selectedAccountId],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "10" });
      if (selectedAccountId) params.set("accountId", selectedAccountId);
      return (await api.get(`/api/transactions?${params.toString()}`)).data.data;
    },
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.error) return <div className="text-[var(--muted)]">خطا در دریافت تراکنش‌ها.</div>;

  const items = q.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">تراکنش‌ها</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {selectedAccountId ? "نمایش یک حساب انتخاب‌شده" : "نمایش همه حساب‌ها"} · تعداد:{" "}
          {q.data.pagination.total}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          تراکنشی یافت نشد.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((tx: any) => (
            <div
              key={tx._id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{tx.title}</div>
                <div className="text-sm text-[var(--muted)]">
                  {tx.date}
                  {tx.accountId?.name ? ` · ${tx.accountId.name}` : ""}
                </div>
              </div>
              <div
                className={
                  tx.type === "income" ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"
                }
              >
                {tx.type === "income" ? "+" : "-"}
                {formatToman(tx.amount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
