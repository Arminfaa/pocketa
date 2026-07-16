"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import type { Transaction } from "@/types/transaction";
import type { BankAccount } from "@/types/account";
import { getTodayJalali, accountIdValue, categoryIdValue } from "@/lib/transaction-helpers";
import { suggestCategory } from "@/services/transactions";
import { TagsInput } from "@/components/ui/tags-input";

const Schema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.string().min(1, "مبلغ را وارد کنید"),
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید"),
  accountId: z.string().min(1, "حساب را انتخاب کنید"),
  title: z.string().min(2, "عنوان حداقل ۲ کاراکتر"),
  description: z.string().optional(),
  date: z
    .string()
    .regex(/^\d{4}\/\d{1,2}\/\d{1,2}$/, "تاریخ باید به صورت ۱۴۰۵/۰۱/۰۱ باشد (با ارقام انگلیسی)"),
});

export type TransactionFormValues = z.infer<typeof Schema>;

type Category = { _id: string; name: string; type: "income" | "expense"; color?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    type: "income" | "expense";
    amount: number;
    categoryId: string;
    accountId: string;
    title: string;
    description?: string | null;
    date: string;
    needsReview?: boolean;
    tags?: string[];
  }) => Promise<void>;
  accounts: BankAccount[];
  categories: Category[];
  initial?: Transaction | null;
  defaultAccountId?: string | null;
  submitting?: boolean;
};

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  accounts,
  categories,
  initial,
  defaultAccountId,
  submitting,
}: Props) {
  const [tags, setTags] = useState<string[]>([]);
  const [suggestLabel, setSuggestLabel] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(Schema),
    defaultValues: {
      type: "expense",
      amount: "",
      categoryId: "",
      accountId: defaultAccountId ?? "",
      title: "",
      description: "",
      date: getTodayJalali(),
    },
  });

  const type = form.watch("type");
  const title = form.watch("title");

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.reset({
        type: initial.type,
        amount: String(initial.amount),
        categoryId: categoryIdValue(initial.categoryId),
        accountId: accountIdValue(initial.accountId) || defaultAccountId || "",
        title: initial.title,
        description: initial.description ?? "",
        date: initial.date,
      });
      setTags(initial.tags ?? []);
    } else {
      form.reset({
        type: "expense",
        amount: "",
        categoryId: "",
        accountId: defaultAccountId ?? accounts[0]?.id ?? "",
        title: "",
        description: "",
        date: getTodayJalali(),
      });
      setTags([]);
    }
    setSuggestLabel(null);
  }, [open, initial, defaultAccountId, accounts, form]);

  useEffect(() => {
    const current = form.getValues("categoryId");
    if (current && !filteredCategories.some((c) => c._id === current)) {
      form.setValue("categoryId", "");
    }
  }, [type, filteredCategories, form]);

  async function applySuggestion() {
    const t = title.trim();
    if (t.length < 2) return;
    setSuggesting(true);
    try {
      const result = await suggestCategory({ title: t, type });
      if (result.suggestion) {
        form.setValue("categoryId", result.suggestion._id, { shouldValidate: true });
        setSuggestLabel(result.suggestion.name);
      } else {
        setSuggestLabel(null);
      }
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/55"
            aria-label="بستن"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-soft max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {initial ? "ویرایش تراکنش" : "افزودن تراکنش"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 rounded-xl border border-[var(--border)] flex items-center justify-center hover:bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            <form
              className="space-y-3"
              onSubmit={form.handleSubmit(async (values) => {
                const amount = Number(values.amount.replace(/,/g, ""));
                if (!Number.isFinite(amount) || amount <= 0) {
                  form.setError("amount", { message: "مبلغ معتبر نیست" });
                  return;
                }
                await onSubmit({
                  type: values.type,
                  amount,
                  categoryId: values.categoryId,
                  accountId: values.accountId,
                  title: values.title.trim(),
                  description: values.description?.trim() || "",
                  date: values.date,
                  needsReview: false,
                  tags,
                });
              })}
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue("type", "expense")}
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
                  onClick={() => form.setValue("type", "income")}
                  className={`rounded-xl py-3 border ${
                    type === "income"
                      ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300"
                      : "border-[var(--border)]"
                  }`}
                >
                  درآمد
                </button>
              </div>

              <label className="block text-sm text-[var(--muted)]">
                عنوان
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  {...form.register("title", {
                    onBlur: () => {
                      void applySuggestion();
                    },
                  })}
                />
                {form.formState.errors.title ? (
                  <span className="text-red-400 text-xs">{form.formState.errors.title.message}</span>
                ) : null}
              </label>

              <label className="block text-sm text-[var(--muted)]">
                مبلغ (تومان)
                <input
                  dir="ltr"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  {...form.register("amount")}
                  placeholder="500000"
                />
                {form.formState.errors.amount ? (
                  <span className="text-red-400 text-xs">{form.formState.errors.amount.message}</span>
                ) : null}
              </label>

              <label className="block text-sm text-[var(--muted)]">
                تاریخ شمسی (YYYY/MM/DD)
                <input
                  dir="ltr"
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  {...form.register("date")}
                  placeholder="1405/04/25"
                />
                {form.formState.errors.date ? (
                  <span className="text-red-400 text-xs">{form.formState.errors.date.message}</span>
                ) : null}
              </label>

              <label className="block text-sm text-[var(--muted)]">
                حساب بانکی
                <select
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  {...form.register("accountId")}
                >
                  <option value="">انتخاب حساب</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.bankName ? ` · ${a.bankName}` : ""}
                    </option>
                  ))}
                </select>
                {form.formState.errors.accountId ? (
                  <span className="text-red-400 text-xs">{form.formState.errors.accountId.message}</span>
                ) : null}
              </label>

              <div className="block text-sm text-[var(--muted)]">
                <div className="flex items-center justify-between gap-2">
                  <span>دسته‌بندی</span>
                  <button
                    type="button"
                    disabled={suggesting || title.trim().length < 2}
                    onClick={() => void applySuggestion()}
                    className="inline-flex items-center gap-1 text-xs text-brand-400 hover:opacity-90 disabled:opacity-40"
                  >
                    <Sparkles size={12} />
                    {suggesting ? "در حال پیشنهاد..." : "پیشنهاد از عنوان"}
                  </button>
                </div>
                <select
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                  {...form.register("categoryId")}
                >
                  <option value="">انتخاب دسته</option>
                  {filteredCategories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {suggestLabel ? (
                  <div className="mt-1 text-xs text-brand-400">پیشنهاد اعمال‌شده: {suggestLabel}</div>
                ) : null}
                {form.formState.errors.categoryId ? (
                  <span className="text-red-400 text-xs">
                    {form.formState.errors.categoryId.message}
                  </span>
                ) : null}
              </div>

              <label className="block text-sm text-[var(--muted)]">
                تگ‌ها (اختیاری)
                <div className="mt-2">
                  <TagsInput value={tags} onChange={setTags} />
                </div>
              </label>

              <label className="block text-sm text-[var(--muted)]">
                توضیحات (اختیاری)
                <textarea
                  className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)] min-h-20"
                  {...form.register("description")}
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-brand-500 text-white py-3 font-medium hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ثبت تراکنش"}
              </button>
            </form>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
