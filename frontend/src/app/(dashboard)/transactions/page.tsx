"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  AlertCircle,
  ReceiptText,
} from "lucide-react";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchAccounts } from "@/services/accounts";
import {
  createTransaction,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  updateTransaction,
} from "@/services/transactions";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { accountName, categoryName } from "@/lib/transaction-helpers";
import { exportTransactionsCsv } from "@/lib/export-transactions-csv";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionFormModal } from "@/features/transactions/TransactionFormModal";

type Filters = {
  search: string;
  type: "" | "income" | "expense";
  categoryId: string;
  tag: string;
  needsReviewOnly: boolean;
};

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "",
    categoryId: "",
    tag: "",
    needsReviewOnly: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const limit = 20;

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const listKey = useMemo(
    () => ["transactions", selectedAccountId, page, filters, limit] as const,
    [selectedAccountId, page, filters, limit]
  );

  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchTransactions({
        page,
        limit,
        search: filters.search || undefined,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        accountId: selectedAccountId,
        tag: filters.tag || undefined,
        needsReview: filters.needsReviewOnly ? true : undefined,
        sortBy: "date",
        sortOrder: "desc",
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createTransaction>[0]) => {
      if (editing) return updateTransaction(editing._id, payload);
      return createTransaction(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "تراکنش به‌روزرسانی شد" : "تراکنش ثبت شد");
      setModalOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره تراکنش";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const data = old as { items: Transaction[]; pagination: { total: number } };
        return {
          ...data,
          items: data.items.filter((t) => t._id !== id),
          pagination: { ...data.pagination, total: Math.max(0, data.pagination.total - 1) },
        };
      });
      return { previous };
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "حذف ناموفق بود";
      toast.error(message);
    },
    onSuccess: () => {
      toast.success("تراکنش حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filteredCategories = (categoriesQ.data ?? []).filter((c) =>
    filters.type ? c.type === filters.type : true
  );

  async function handleExport() {
    try {
      const all = await fetchTransactions({
        page: 1,
        limit: 100,
        search: filters.search || undefined,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        accountId: selectedAccountId,
        tag: filters.tag || undefined,
        needsReview: filters.needsReviewOnly ? true : undefined,
        sortBy: "date",
        sortOrder: "desc",
      });
      exportTransactionsCsv(all.items);
      toast.success("خروجی CSV آماده شد");
    } catch {
      toast.error("خروجی CSV ناموفق بود");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">تراکنش‌ها</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {selectedAccountId ? "فیلتر یک حساب از هدر فعال است" : "نمایش همه حساب‌ها"} · {total} مورد
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:bg-white/5"
          >
            <Download size={16} />
            خروجی CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 text-white px-3 py-2.5 text-sm font-medium hover:opacity-95"
          >
            <Plus size={16} />
            تراکنش جدید
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-transparent pr-9 pl-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="جستجو در عنوان یا توضیحات..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  setFilters((f) => ({ ...f, search: searchInput.trim() }));
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setFilters((f) => ({ ...f, search: searchInput.trim() }));
            }}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 hover:bg-white/5"
          >
            جستجو
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            value={filters.type}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({
                ...f,
                type: e.target.value as Filters["type"],
                categoryId: "",
              }));
            }}
          >
            <option value="">همه انواع</option>
            <option value="income">درآمد</option>
            <option value="expense">هزینه</option>
          </select>

          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            value={filters.categoryId}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, categoryId: e.target.value }));
            }}
          >
            <option value="">همه دسته‌ها</option>
            {filteredCategories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            placeholder="فیلتر تگ"
            value={filters.tag}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, tag: e.target.value.trim() }));
            }}
          />

          <button
            type="button"
            onClick={() => {
              setPage(1);
              setFilters((f) => ({ ...f, needsReviewOnly: !f.needsReviewOnly }));
            }}
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              filters.needsReviewOnly
                ? "border-amber-400/50 bg-amber-500/10 text-amber-300"
                : "border-[var(--border)]"
            }`}
          >
            فقط نیاز به بررسی
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setPage(1);
              setFilters({ search: "", type: "", categoryId: "", tag: "", needsReviewOnly: false });
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:bg-white/5"
          >
            پاک کردن فیلترها
          </button>
        </div>
      </div>

      {listQ.isLoading ? <Skeleton className="h-64 w-full" /> : null}
      {listQ.error ? (
        <QueryError
          message="خطا در دریافت تراکنش‌ها."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="تراکنشی یافت نشد"
          description="یک تراکنش جدید اضافه کنید یا فیلترها را تغییر دهید."
        />
      ) : null}

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {items.map((tx) => (
          <div
            key={tx._id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span className="truncate">{tx.title}</span>
                  {tx.needsReview ? (
                    <span className="inline-flex items-center gap-1 text-xs rounded-lg bg-amber-500/15 text-amber-300 px-2 py-0.5">
                      <AlertCircle size={12} />
                      بررسی
                    </span>
                  ) : null}
                </div>
                {(tx.tags?.length ?? 0) > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tx.tags!.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setFilters((f) => ({ ...f, tag }));
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-brand-500/10 text-brand-400"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="text-sm text-[var(--muted)] mt-1">
                  {formatJalaliDate(tx.date)} · {categoryName(tx.categoryId)} ·{" "}
                  {accountName(tx.accountId)}
                </div>
              </div>
              <div
                className={
                  tx.type === "income"
                    ? "text-emerald-400 font-semibold whitespace-nowrap"
                    : "text-red-400 font-semibold whitespace-nowrap"
                }
              >
                {tx.type === "income" ? "+" : "-"}
                {formatToman(tx.amount)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(tx);
                  setModalOpen(true);
                }}
                className="flex-1 rounded-xl border border-[var(--border)] py-2 text-sm hover:bg-white/5"
              >
                ویرایش
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("این تراکنش حذف شود؟")) deleteMutation.mutate(tx._id);
                }}
                className="flex-1 rounded-xl border border-red-400/30 text-red-300 py-2 text-sm hover:bg-red-500/10"
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      {items.length > 0 ? (
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--muted)]">
              <tr>
                <th className="text-right font-medium px-4 py-3">تاریخ</th>
                <th className="text-right font-medium px-4 py-3">نوع</th>
                <th className="text-right font-medium px-4 py-3">دسته‌بندی</th>
                <th className="text-right font-medium px-4 py-3">حساب</th>
                <th className="text-right font-medium px-4 py-3">عنوان</th>
                <th className="text-right font-medium px-4 py-3">مبلغ</th>
                <th className="text-right font-medium px-4 py-3">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx._id} className="border-b border-[var(--border)]/60 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatJalaliDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        tx.type === "income"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {tx.type === "income" ? "درآمد" : "هزینه"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{categoryName(tx.categoryId)}</td>
                  <td className="px-4 py-3">{accountName(tx.accountId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{tx.title}</span>
                      {tx.needsReview ? (
                        <span className="inline-flex items-center gap-1 text-xs rounded-lg bg-amber-500/15 text-amber-300 px-2 py-0.5">
                          <AlertCircle size={12} />
                          بررسی
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap font-medium ${
                      tx.type === "income" ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatToman(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(tx);
                          setModalOpen(true);
                        }}
                        className="h-9 w-9 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center justify-center"
                        aria-label="ویرایش"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("این تراکنش حذف شود؟")) deleteMutation.mutate(tx._id);
                        }}
                        className="h-9 w-9 rounded-xl border border-[var(--border)] hover:bg-red-500/10 text-red-300 flex items-center justify-center"
                        aria-label="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"
          >
            قبلی
          </button>
          <span className="text-sm text-[var(--muted)]">
            صفحه {page} از {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-40"
          >
            بعدی
          </button>
        </div>
      ) : null}

      <TransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        accounts={accountsQ.data ?? []}
        categories={categoriesQ.data ?? []}
        initial={editing}
        defaultAccountId={selectedAccountId ?? accountsQ.data?.[0]?.id ?? null}
        submitting={saveMutation.isPending}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
      />
    </div>
  );
}
