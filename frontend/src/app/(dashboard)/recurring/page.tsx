"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Play, Plus, Trash2 } from "lucide-react";
import {
  createRecurring,
  deleteRecurring,
  fetchRecurring,
  generateRecurring,
} from "@/services/recurring";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";

const FREQ_LABEL: Record<string, string> = {
  weekly: "هفتگی",
  monthly: "ماهانه",
  yearly: "سالانه",
};

export default function RecurringPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [nextPaymentDate, setNextPaymentDate] = useState(getTodayJalali());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const listQ = useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === type),
    [categoriesQ.data, type]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(/,/g, ""));
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(value) || value <= 0) throw new Error("مبلغ معتبر نیست");
      const acc = accountId || accountsQ.data?.[0]?.id;
      if (!acc) throw new Error("حساب را انتخاب کنید");
      if (!categoryId) throw new Error("دسته را انتخاب کنید");
      return createRecurring({
        title: title.trim(),
        amount: value,
        type,
        frequency,
        nextPaymentDate,
        accountId: acc,
        categoryId,
      });
    },
    onSuccess: () => {
      toast.success("پرداخت تکرارشونده ثبت شد");
      setTitle("");
      setAmount("");
      setCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
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

  const generateMutation = useMutation({
    mutationFn: (id: string) => generateRecurring(id),
    onSuccess: () => {
      toast.success("تراکنش ساخته شد و موعد بعدی جلو رفت");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در تولید تراکنش";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => {
      toast.success("حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
  });

  const items = listQ.data?.items ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <CalendarClock size={22} />
          پرداخت‌های تکرارشونده
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          اجاره، اینترنت، حقوق و ... را ثبت کنید و در موعد با یک کلیک به تراکنش تبدیل کنید.
        </p>
      </div>

      {(listQ.data?.dueCount ?? 0) > 0 ? (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          {listQ.data?.dueCount} مورد به موعد رسیده یا گذشته است.
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">
          <Plus size={18} />
          افزودن مورد جدید
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setType("expense");
              setCategoryId("");
            }}
            className={`rounded-xl py-3 border ${
              type === "expense"
                ? "border-red-400/50 bg-red-500/10 text-red-300"
                : "border-[var(--border)]"
            }`}
          >
            هزینه
          </button>
          <button
            type="button"
            onClick={() => {
              setType("income");
              setCategoryId("");
            }}
            className={`rounded-xl py-3 border ${
              type === "income"
                ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                : "border-[var(--border)]"
            }`}
          >
            درآمد
          </button>
        </div>

        <input
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
          placeholder="عنوان (مثلاً اینترنت)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          dir="ltr"
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
          placeholder="مبلغ تومان"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as typeof frequency)}
          >
            <option value="weekly">هفتگی</option>
            <option value="monthly">ماهانه</option>
            <option value="yearly">سالانه</option>
          </select>
          <input
            dir="ltr"
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={nextPaymentDate}
            onChange={(e) => setNextPaymentDate(e.target.value)}
            placeholder="1405/04/01"
          />
          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={accountId || accountsQ.data?.[0]?.id || ""}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {(accountsQ.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">انتخاب دسته</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
        >
          {createMutation.isPending ? "در حال ذخیره..." : "ثبت"}
        </button>
      </div>

      {listQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {listQ.error ? (
        <QueryError
          message="خطا در دریافت پرداخت‌های تکرارشونده."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      <div className="space-y-3">
        {items.map((item) => {
          const accountName =
            typeof item.account === "object" && item.account ? item.account.name : "—";
          const categoryName =
            typeof item.category === "object" && item.category ? item.category.name : "—";
          return (
            <div
              key={item.id}
              className={`rounded-2xl border bg-[var(--card)] p-4 space-y-3 ${
                item.isDue ? "border-amber-400/40" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-[var(--muted)] mt-1">
                    {FREQ_LABEL[item.frequency] ?? item.frequency} · موعد{" "}
                    {formatJalaliDate(item.nextPaymentDate)} · {accountName} · {categoryName}
                    {item.isDue ? " · سررسید شده" : ""}
                  </div>
                </div>
                <div
                  className={
                    item.type === "income"
                      ? "text-emerald-400 font-semibold"
                      : "text-red-400 font-semibold"
                  }
                >
                  {formatToman(item.amount)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => generateMutation.mutate(item.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 text-white px-3 py-2 text-sm"
                >
                  <Play size={14} />
                  ثبت تراکنش الان
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("حذف شود؟")) deleteMutation.mutate(item.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-red-300"
                >
                  <Trash2 size={14} />
                  حذف
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="هنوز پرداخت تکرارشونده‌ای ثبت نشده"
          description="اجاره، اینترنت یا حقوق را اینجا تعریف کنید."
        />
      ) : null}
    </div>
  );
}
