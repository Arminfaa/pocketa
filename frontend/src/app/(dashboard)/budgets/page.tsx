"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { deleteBudget, fetchBudgets, upsertBudget } from "@/services/budgets";
import { fetchCategories } from "@/services/categories";
import { formatToman } from "@/lib/format";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const current = getJalaliMonthYear();
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const budgetsQ = useQuery({
    queryKey: ["budgets", month, year],
    queryFn: () => fetchBudgets({ month, year }),
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const expenseCategories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === "expense"),
    [categoriesQ.data]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(/,/g, ""));
      if (!categoryId) throw new Error("دسته را انتخاب کنید");
      if (!Number.isFinite(value) || value <= 0) throw new Error("مبلغ معتبر نیست");
      return upsertBudget({ categoryId, amount: value, month, year });
    },
    onSuccess: () => {
      toast.success("بودجه ذخیره شد");
      setAmount("");
      setCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره بودجه";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      toast.success("بودجه حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف بودجه";
      toast.error(message);
    },
  });

  const items = budgetsQ.data?.items ?? [];
  const summary = budgetsQ.data?.summary;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">بودجه‌بندی</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          برای هر دسته هزینه سقف ماهانه تعیین کنید و مصرف را ببینید.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm text-[var(--muted)]">
          ماه
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_LABELS.map((label, idx) => (
              <option key={label} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-[var(--muted)]">
          سال
          <input
            dir="ltr"
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || current.year)}
          />
        </label>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">کل بودجه</div>
            <div className="font-semibold mt-1">{formatToman(summary.totalBudget)}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">مصرف‌شده</div>
            <div className="font-semibold mt-1">{formatToman(summary.totalConsumed)}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">هشدارها</div>
            <div className="font-semibold mt-1 text-amber-300">
              {summary.warningCount} نزدیک · {summary.dangerCount} رد شده
            </div>
          </div>
        </div>
      ) : null}

      {(summary?.warningCount ?? 0) + (summary?.dangerCount ?? 0) > 0 ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex gap-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          بعضی بودجه‌ها به سقف نزدیک شده‌اند یا از آن رد شده‌اند. هزینه‌های این ماه را بررسی کنید.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">
          <Plus size={18} />
          تنظیم / به‌روزرسانی بودجه
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            دسته هزینه
            <select
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">انتخاب کنید</option>
              {expenseCategories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--muted)]">
            سقف ماهانه (تومان)
            <input
              dir="ltr"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="3000000"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
        >
          {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره بودجه"}
        </button>
      </div>

      {budgetsQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {budgetsQ.error ? (
        <div className="text-[var(--muted)]">خطا در دریافت بودجه‌ها.</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((b) => {
          const barColor =
            b.status === "danger"
              ? "bg-red-500"
              : b.status === "warning"
                ? "bg-amber-400"
                : "bg-brand-500";
          const statusLabel =
            b.status === "danger"
              ? "از سقف رد شده"
              : b.status === "warning"
                ? "نزدیک به سقف (۸۰٪+)"
                : "در محدوده";

          return (
            <div
              key={b.id}
              className={`rounded-2xl border bg-[var(--card)] p-4 ${
                b.status === "danger"
                  ? "border-red-400/40"
                  : b.status === "warning"
                    ? "border-amber-400/40"
                    : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-7 w-7 rounded-xl shrink-0"
                    style={{ background: b.category?.color ?? "#06b6d4" }}
                  />
                  <div className="font-medium truncate">{b.category?.name ?? "دسته"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("این بودجه حذف شود؟")) deleteMutation.mutate(b.id);
                  }}
                  className="h-8 w-8 rounded-xl border border-[var(--border)] hover:bg-red-500/10 text-red-300 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="mt-3 text-sm text-[var(--muted)] flex justify-between gap-2">
                <span>مصرف: {formatToman(b.consumed)}</span>
                <span>سقف: {formatToman(b.amount)}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                باقیمانده: {formatToman(b.remaining)} · {b.rawPercent.toFixed(0)}% · {statusLabel}
              </div>

              <div className="mt-2 h-3 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full ${barColor}`} style={{ width: `${b.percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {!budgetsQ.isLoading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          بودجه‌ای برای {MONTH_LABELS[month - 1]} {year} ثبت نشده است.
        </div>
      ) : null}
    </div>
  );
}
