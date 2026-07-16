"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileInput, CheckCircle2, AlertTriangle } from "lucide-react";
import { fetchAccounts } from "@/services/accounts";
import { confirmBankSms, previewBankSms, type ParsedImportItem } from "@/services/imports";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { formatToman, formatJalaliDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function currentJalaliYearGuess(): number {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1405";
    return Number(y.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  } catch {
    return 1405;
  }
}

export default function BankSmsImportPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const [rawText, setRawText] = useState("");
  const [accountId, setAccountId] = useState(selectedAccountId ?? "");
  const [jalaliYear, setJalaliYear] = useState(String(currentJalaliYearGuess()));
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [failedBlocks, setFailedBlocks] = useState<string[]>([]);
  const [previewMeta, setPreviewMeta] = useState<{
    bankHint: string;
    duplicateCount: number;
  } | null>(null);

  const effectiveAccountId = accountId || accountsQ.data?.[0]?.id || "";

  const previewMutation = useMutation({
    mutationFn: () =>
      previewBankSms({
        rawText,
        accountId: effectiveAccountId,
        jalaliYear: Number(jalaliYear),
      }),
    onSuccess: (data) => {
      setItems(data.items);
      setFailedBlocks(data.failedBlocks);
      setPreviewMeta({ bankHint: data.bankHint, duplicateCount: data.duplicateCount });
      const next: Record<string, boolean> = {};
      for (const item of data.items) {
        next[item.importHash] = !item.isDuplicate;
      }
      setSelected(next);
      toast.success(`${data.parsedCount} پیامک شناسایی شد`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در پردازش پیامک‌ها";
      toast.error(message);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const selectedHashes = items
        .filter((i) => selected[i.importHash] && !i.isDuplicate)
        .map((i) => i.importHash);
      return confirmBankSms({
        rawText,
        accountId: effectiveAccountId,
        jalaliYear: Number(jalaliYear),
        selectedHashes,
      });
    },
    onSuccess: (data) => {
      toast.success(`${data.importedCount} تراکنش وارد شد`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      router.push("/review");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره ایمپورت";
      toast.error(message);
    },
  });

  const selectedCount = useMemo(
    () => items.filter((i) => selected[i.importHash] && !i.isDuplicate).length,
    [items, selected]
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileInput size={22} />
          ایمپورت پیامک بانکی
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          پیامک‌های بانک (یا فوروارد تلگرام) را Paste کنید. مبالغ پیامک به{" "}
          <strong>ریال</strong> هستند و هنگام ایمپورت خودکار به{" "}
          <strong>تومان</strong> تبدیل می‌شوند (÷۱۰). هر پیامک یک تراکنش جدا می‌شود.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-[var(--muted)]">
            حساب مقصد
            {accountsQ.isLoading ? <Skeleton className="h-11 w-full mt-2" /> : null}
            {!accountsQ.isLoading ? (
              <select
                className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={effectiveAccountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {(accountsQ.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.bankName ? ` · ${a.bankName}` : ""}
                  </option>
                ))}
              </select>
            ) : null}
          </label>

          <label className="text-sm text-[var(--muted)]">
            سال شمسی (برای تاریخ‌های بدون سال)
            <input
              dir="ltr"
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              value={jalaliYear}
              onChange={(e) => setJalaliYear(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm text-[var(--muted)]">
          متن پیامک‌ها
          <textarea
            className="mt-2 w-full min-h-48 rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)] font-mono text-sm"
            dir="ltr"
            placeholder={`مثال:\n777.888.12322409.1\n-9,500,000\n04/23_21:47\nمانده: 20,929,124`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </label>

        <button
          type="button"
          disabled={previewMutation.isPending || rawText.trim().length < 10 || !effectiveAccountId}
          onClick={() => previewMutation.mutate()}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
        >
          {previewMutation.isPending ? "در حال پردازش..." : "پیش‌نمایش"}
        </button>
      </div>

      {previewMeta ? (
        <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
          {previewMeta.bankHint ? <span>بانک تشخیص‌داده‌شده: {previewMeta.bankHint}</span> : null}
          <span>تکراری: {previewMeta.duplicateCount}</span>
          <span>انتخاب‌شده برای ورود: {selectedCount}</span>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">پیش‌نمایش تراکنش‌ها</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-white/5"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  for (const item of items) {
                    next[item.importHash] = !item.isDuplicate;
                  }
                  setSelected(next);
                }}
              >
                انتخاب همه
              </button>
              <button
                type="button"
                className="text-sm rounded-xl border border-[var(--border)] px-3 py-2 hover:bg-white/5"
                onClick={() => setSelected({})}
              >
                هیچ‌کدام
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <label
                key={item.importHash}
                className={`flex gap-3 rounded-2xl border p-4 ${
                  item.isDuplicate
                    ? "border-amber-400/30 bg-amber-500/5 opacity-80"
                    : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={item.isDuplicate}
                  checked={Boolean(selected[item.importHash])}
                  onChange={(e) =>
                    setSelected((s) => ({ ...s, [item.importHash]: e.target.checked }))
                  }
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">
                      {item.type === "income" ? "واریز" : "برداشت"}
                      {item.bankName ? ` · ${item.bankName}` : ""}
                    </div>
                    <div
                      className={
                        item.type === "income"
                          ? "text-emerald-400 font-semibold"
                          : "text-red-400 font-semibold"
                      }
                    >
                      {item.type === "income" ? "+" : "-"}
                      {formatToman(item.amount)}
                    </div>
                  </div>
                  <div className="text-sm text-[var(--muted)]">
                    {formatJalaliDate(item.date)}
                    {item.time ? ` · ${item.time}` : ""}
                    {item.balanceAfter !== undefined
                      ? ` · مانده ${formatToman(item.balanceAfter)}`
                      : ""}
                  </div>
                  {item.isDuplicate ? (
                    <div className="text-xs text-amber-300 inline-flex items-center gap-1">
                      <AlertTriangle size={12} />
                      قبلاً ایمپورت شده — رد می‌شود
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--muted)] inline-flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      آماده ورود · نیاز به نام‌گذاری بعداً
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={confirmMutation.isPending || selectedCount === 0}
            onClick={() => confirmMutation.mutate()}
            className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
          >
            {confirmMutation.isPending
              ? "در حال ذخیره..."
              : `تأیید و ورود ${selectedCount} تراکنش`}
          </button>
        </div>
      ) : null}

      {failedBlocks.length > 0 ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/5 p-4 space-y-2">
          <div className="font-medium text-red-300">
            {failedBlocks.length} بلوک قابل parse نبود
          </div>
          {failedBlocks.slice(0, 3).map((b, i) => (
            <pre
              key={i}
              className="text-xs whitespace-pre-wrap text-[var(--muted)] border border-[var(--border)] rounded-xl p-2"
            >
              {b}
            </pre>
          ))}
        </div>
      ) : null}
    </div>
  );
}
