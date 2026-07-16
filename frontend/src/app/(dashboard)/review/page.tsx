"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Check, ClipboardCheck } from "lucide-react";
import {
  fetchCategories,
  fetchTransactions,
  updateTransaction,
} from "@/services/transactions";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman } from "@/lib/format";
import {
  categoryIdValue,
  categoryName,
  accountName,
} from "@/lib/transaction-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useAccountFilterStore } from "@/stores/account-filter.store";

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const listQ = useQuery({
    queryKey: ["transactions", "review", selectedAccountId],
    queryFn: () =>
      fetchTransactions({
        page: 1,
        limit: 50,
        needsReview: true,
        accountId: selectedAccountId,
        sortBy: "date",
        sortOrder: "desc",
      }),
  });

  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [drafts, setDrafts] = useState<
    Record<string, { title: string; categoryId: string }>
  >({});

  function getDraft(tx: Transaction) {
    return (
      drafts[tx._id] ?? {
        title: tx.title.includes("بدون عنوان") ? "" : tx.title,
        categoryId: categoryIdValue(tx.categoryId),
      }
    );
  }

  const saveMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const draft = getDraft(tx);
      if (draft.title.trim().length < 2) {
        throw new Error("عنوان حداقل ۲ کاراکتر باشد");
      }
      return updateTransaction(tx._id, {
        title: draft.title.trim(),
        categoryId: draft.categoryId || categoryIdValue(tx.categoryId),
        needsReview: false,
      });
    },
    onSuccess: (_data, tx) => {
      toast.success("عنوان ذخیره شد");
      setDrafts((d) => {
        const next = { ...d };
        delete next[tx._id];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره";
      toast.error(message);
    },
  });

  const items = listQ.data?.items ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle size={22} className="text-amber-300" />
          نام‌گذاری تراکنش‌های ایمپورت‌شده
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          برای هر واریز/برداشت مشخص کنید برای چه بوده، سپس ذخیره کنید.
        </p>
      </div>

      {listQ.isLoading ? <Skeleton className="h-48 w-full" /> : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="موردی برای بررسی نیست"
          description="از صفحه ایمپورت پیامک بانکی شروع کنید تا تراکنش‌های جدید اینجا بیایند."
        />
      ) : null}

      <div className="space-y-3">
        {items.map((tx) => {
          const draft = getDraft(tx);
          const cats = (categoriesQ.data ?? []).filter((c) => c.type === tx.type);
          return (
            <div
              key={tx._id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm text-[var(--muted)]">
                  {formatJalaliDate(tx.date)}
                  {tx.bankMeta?.time ? ` · ${tx.bankMeta.time}` : ""}
                  {" · "}
                  {accountName(tx.accountId)}
                  {" · "}
                  {categoryName(tx.categoryId)}
                </div>
                <div
                  className={
                    tx.type === "income"
                      ? "text-emerald-400 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatToman(tx.amount)}
                </div>
              </div>

              <input
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                placeholder="مثلاً اجاره / حقوق / خرید لپ‌تاپ"
                value={draft.title}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [tx._id]: { ...draft, title: e.target.value },
                  }))
                }
              />

              <select
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={draft.categoryId}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [tx._id]: { ...draft, categoryId: e.target.value },
                  }))
                }
              >
                {cats.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate(tx)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 text-white px-4 py-2.5 text-sm font-medium hover:opacity-95 disabled:opacity-60"
              >
                <Check size={16} />
                ذخیره و خروج از بررسی
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
