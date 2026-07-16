"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
} from "@/services/accounts";
import { formatToman } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { BankAccount } from "@/types/account";

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

type FormState = {
  name: string;
  bankName: string;
  color: string;
  initialBalance: string;
};

const emptyForm: FormState = {
  name: "",
  bankName: "",
  color: COLORS[0]!,
  initialBalance: "0",
};

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        bankName: form.bankName.trim() || undefined,
        color: form.color,
        initialBalance: Number(form.initialBalance.replace(/,/g, "")) || 0,
      };
      if (editingId) return updateAccount(editingId, payload);
      return createAccount(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "حساب به‌روزرسانی شد" : "حساب جدید ساخته شد");
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره حساب";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      toast.success("حساب غیرفعال شد");
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف حساب";
      toast.error(message);
    },
  });

  const totalBalance = useMemo(
    () => (q.data ?? []).reduce((sum, a) => sum + a.balance, 0),
    [q.data]
  );

  function startEdit(account: BankAccount) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      bankName: account.bankName,
      color: account.color,
      initialBalance: String(account.initialBalance),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">حساب‌های بانکی</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            هر بانک یا کارت را جدا اضافه کنید؛ بعد می‌توانید تراکنش‌ها را جدا یا یکجا ببینید.
          </p>
        </div>
        <div className="text-left">
          <div className="text-xs text-[var(--muted)]">مجموع موجودی</div>
          <div className="font-semibold text-brand-500">{formatToman(totalBalance)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
        <div className="flex items-center gap-2 font-medium">
          <Plus size={18} />
          {editingId ? "ویرایش حساب" : "افزودن حساب جدید"}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            نام حساب
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="مثلاً کارت پاسارگاد"
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            نام بانک (اختیاری)
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={form.bankName}
              onChange={(e) => setForm((s) => ({ ...s, bankName: e.target.value }))}
              placeholder="پاسارگاد / ملی / ..."
            />
          </label>
          <label className="text-sm text-[var(--muted)]">
            موجودی اولیه (تومان)
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              dir="ltr"
              value={form.initialBalance}
              onChange={(e) => setForm((s) => ({ ...s, initialBalance: e.target.value }))}
            />
          </label>
          <div className="text-sm text-[var(--muted)]">
            رنگ
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, color: c }))}
                  className="h-8 w-8 rounded-xl border border-[var(--border)]"
                  style={{
                    background: c,
                    outline: form.color === c ? "2px solid white" : undefined,
                    outlineOffset: 2,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={saveMutation.isPending || form.name.trim().length < 2}
            onClick={() => saveMutation.mutate()}
            className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
          >
            {saveMutation.isPending ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن حساب"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-white/5"
            >
              انصراف
            </button>
          ) : null}
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {q.error ? (
        <div className="rounded-2xl border border-[var(--border)] p-6 text-[var(--muted)]">
          خطا در دریافت حساب‌ها.
        </div>
      ) : null}

      <div className="space-y-3">
        {(q.data ?? []).map((account) => (
          <div
            key={account.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ background: account.color }}
              >
                <Landmark size={20} />
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{account.name}</div>
                <div className="text-sm text-[var(--muted)] truncate">
                  {account.bankName || "بدون نام بانک"} · موجودی اولیه{" "}
                  {formatToman(account.initialBalance)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="text-left me-2">
                <div className="text-xs text-[var(--muted)]">موجودی</div>
                <div className="font-semibold">{formatToman(account.balance)}</div>
              </div>
              <button
                type="button"
                onClick={() => startEdit(account)}
                className="h-10 w-10 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center justify-center"
                aria-label="ویرایش"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`حساب «${account.name}» غیرفعال شود؟`)) {
                    deleteMutation.mutate(account.id);
                  }
                }}
                className="h-10 w-10 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center justify-center text-red-400"
                aria-label="حذف"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
            هنوز حسابی ثبت نشده است.
          </div>
        ) : null}
      </div>
    </div>
  );
}
