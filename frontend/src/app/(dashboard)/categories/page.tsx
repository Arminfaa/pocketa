"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from "@/services/categories";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";

type FormState = {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
};

const emptyForm: FormState = {
  name: "",
  type: "expense",
  icon: "Utensils",
  color: CATEGORY_COLORS[0]!,
};

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const q = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        icon: form.icon,
        color: form.color,
      };
      if (editingId) return updateCategory(editingId, payload);
      return createCategory(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "دسته به‌روزرسانی شد" : "دسته جدید ساخته شد");
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره دسته";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast.success("دسته حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف دسته";
      toast.error(message);
    },
  });

  const items = useMemo(() => {
    const all = q.data ?? [];
    if (filter === "all") return all;
    return all.filter((c) => c.type === filter);
  }, [q.data, filter]);

  function startEdit(c: Category) {
    setEditingId(c._id);
    setForm({
      name: c.name,
      type: c.type,
      icon: c.icon || "Utensils",
      color: c.color || CATEGORY_COLORS[0]!,
    });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">دسته‌بندی‌ها</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          دسته‌های درآمد و هزینه را با رنگ و آیکون مدیریت کنید.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
        <div className="font-medium flex items-center gap-2">
          <Plus size={18} />
          {editingId ? "ویرایش دسته" : "افزودن دسته جدید"}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)] md:col-span-2">
            نام
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="مثلاً خوراک"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 md:col-span-2">
            <button
              type="button"
              onClick={() => setForm((s) => ({ ...s, type: "expense" }))}
              className={`rounded-xl py-3 border ${
                form.type === "expense"
                  ? "border-red-400/50 bg-red-500/10 text-red-300"
                  : "border-[var(--border)]"
              }`}
            >
              هزینه
            </button>
            <button
              type="button"
              onClick={() => setForm((s) => ({ ...s, type: "income" }))}
              className={`rounded-xl py-3 border ${
                form.type === "income"
                  ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                  : "border-[var(--border)]"
              }`}
            >
              درآمد
            </button>
          </div>

          <div className="text-sm text-[var(--muted)] md:col-span-2">
            رنگ
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
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
                />
              ))}
            </div>
          </div>

          <div className="text-sm text-[var(--muted)] md:col-span-2">
            آیکون
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORY_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, icon }))}
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    form.icon === icon
                      ? "border-brand-500 bg-brand-500/10 text-brand-400"
                      : "border-[var(--border)]"
                  }`}
                >
                  {icon}
                </button>
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
            {saveMutation.isPending ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-white/5"
            >
              انصراف
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["all", "همه"],
            ["expense", "هزینه"],
            ["income", "درآمد"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              filter === key
                ? "border-brand-500/50 bg-brand-500/10 text-brand-400"
                : "border-[var(--border)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {q.error ? (
        <div className="text-[var(--muted)]">خطا در دریافت دسته‌بندی‌ها.</div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-3">
        {items.map((c) => (
          <div
            key={c._id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center text-[10px] text-white font-medium"
                style={{ background: c.color }}
                title={c.icon}
              >
                {c.icon?.slice(0, 2) ?? "?"}
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-[var(--muted)]">
                  {c.type === "income" ? "درآمد" : "هزینه"} · {c.icon}
                </div>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => startEdit(c)}
                className="h-9 w-9 rounded-xl border border-[var(--border)] hover:bg-white/5 flex items-center justify-center"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`دسته «${c.name}» حذف شود؟`)) deleteMutation.mutate(c._id);
                }}
                className="h-9 w-9 rounded-xl border border-[var(--border)] hover:bg-red-500/10 text-red-300 flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
