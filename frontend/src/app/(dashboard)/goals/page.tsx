"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Target, Trash2 } from "lucide-react";
import {
  contributeGoal,
  createGoal,
  deleteGoal,
  fetchGoals,
} from "@/services/goals";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]!);
  const [contributeAmounts, setContributeAmounts] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const createMutation = useMutation({
    mutationFn: async () => {
      const target = Number(targetAmount.replace(/,/g, ""));
      const current = Number(currentAmount.replace(/,/g, "")) || 0;
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(target) || target <= 0) throw new Error("مبلغ هدف معتبر نیست");
      return createGoal({
        title: title.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline || undefined,
        color,
      });
    },
    onSuccess: () => {
      toast.success("هدف پس‌انداز ساخته شد");
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("0");
      setDeadline("");
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره هدف";
      toast.error(message);
    },
  });

  const contributeMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) =>
      contributeGoal(id, amount),
    onSuccess: (_data, vars) => {
      toast.success("به هدف اضافه شد");
      setContributeAmounts((s) => ({ ...s, [vars.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در افزودن مبلغ";
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      toast.success("هدف حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const items = q.data?.items ?? [];
  const summary = q.data?.summary;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Target size={22} />
          اهداف پس‌انداز
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          برای سفر، خرید یا اضطراری هدف بگذارید و پیشرفت را دنبال کنید.
        </p>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">کل اهداف</div>
            <div className="font-semibold mt-1">{formatToman(summary.totalTarget)}</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">پس‌انداز شده</div>
            <div className="font-semibold mt-1 text-brand-400">
              {formatToman(summary.totalSaved)}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="text-xs text-[var(--muted)]">تکمیل‌شده</div>
            <div className="font-semibold mt-1">{summary.completedCount}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <div className="font-medium flex items-center gap-2">
          <Plus size={18} />
          هدف جدید
        </div>
        <input
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
          placeholder="مثلاً سفر شمال"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <input
            dir="ltr"
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            placeholder="مبلغ هدف (تومان)"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
          />
          <input
            dir="ltr"
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            placeholder="پس‌انداز فعلی"
            value={currentAmount}
            onChange={(e) => setCurrentAmount(e.target.value)}
          />
          <input
            dir="ltr"
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-3"
            placeholder="مهلت اختیاری YYYY/MM/DD"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 items-center">
            {CATEGORY_COLORS.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-xl border border-[var(--border)]"
                style={{
                  background: c,
                  outline: color === c ? "2px solid white" : undefined,
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
        >
          {createMutation.isPending ? "در حال ذخیره..." : "ایجاد هدف"}
        </button>
      </div>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : null}

      <div className="space-y-3">
        {items.map((goal) => (
          <div
            key={goal.id}
            className={`rounded-2xl border bg-[var(--card)] p-4 space-y-3 ${
              goal.completed ? "border-emerald-400/40" : "border-[var(--border)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-10 w-10 rounded-xl shrink-0"
                  style={{ background: goal.color }}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {goal.title}
                    {goal.completed ? " ✓" : ""}
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {formatToman(goal.currentAmount)} از {formatToman(goal.targetAmount)}
                    {goal.deadline ? ` · مهلت ${formatJalaliDate(goal.deadline)}` : ""}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("این هدف حذف شود؟")) deleteMutation.mutate(goal.id);
                }}
                className="h-9 w-9 rounded-xl border border-[var(--border)] text-red-300 flex items-center justify-center"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${goal.percent}%`, background: goal.color }}
              />
            </div>
            <div className="text-xs text-[var(--muted)]">
              {goal.percent.toFixed(0)}% · باقیمانده {formatToman(goal.remaining)}
            </div>

            {!goal.completed ? (
              <div className="flex gap-2">
                <input
                  dir="ltr"
                  className="flex-1 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5"
                  placeholder="مبلغ افزودنی"
                  value={contributeAmounts[goal.id] ?? ""}
                  onChange={(e) =>
                    setContributeAmounts((s) => ({ ...s, [goal.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = Number((contributeAmounts[goal.id] ?? "").replace(/,/g, ""));
                    if (!Number.isFinite(value) || value <= 0) {
                      toast.error("مبلغ معتبر نیست");
                      return;
                    }
                    contributeMutation.mutate({ id: goal.id, amount: value });
                  }}
                  className="rounded-xl bg-brand-500 text-white px-4 py-2.5 text-sm"
                >
                  افزودن
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {!q.isLoading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)]">
          هنوز هدفی تعریف نشده است.
        </div>
      ) : null}
    </div>
  );
}
