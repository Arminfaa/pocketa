"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchCategoryReport, fetchMonthlyReport } from "@/services/reports";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PIE_FALLBACK = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

export default function ReportsPage() {
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const current = getJalaliMonthYear();
  const [months, setMonths] = useState(6);
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);

  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", selectedAccountId, months],
    queryFn: () => fetchMonthlyReport({ months, accountId: selectedAccountId }),
  });

  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId, month, year],
    queryFn: () =>
      fetchCategoryReport({ month, year, accountId: selectedAccountId }),
  });

  const monthlyChart = useMemo(() => {
    const data = monthlyQ.data;
    if (!data) return [];
    return data.labels.map((label, i) => ({
      label,
      income: data.income[i] ?? 0,
      expense: data.expense[i] ?? 0,
      net: data.net?.[i] ?? (data.income[i] ?? 0) - (data.expense[i] ?? 0),
    }));
  }, [monthlyQ.data]);

  const expensePie = useMemo(() => {
    return (categoriesQ.data?.expense ?? []).map((c, i) => ({
      name: c.name,
      value: c.amount,
      color: c.color || PIE_FALLBACK[i % PIE_FALLBACK.length],
    }));
  }, [categoriesQ.data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">گزارش‌ها</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {selectedAccountId
              ? "گزارش‌ها بر اساس حساب انتخاب‌شده در هدر فیلتر شده‌اند."
              : "نمایش گزارش همه حساب‌ها. از هدر می‌توانید یک حساب را انتخاب کنید."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted)] font-medium">
              مجموع درآمد بازه
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-emerald-400">
            {monthlyQ.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              formatToman(monthlyQ.data?.summary.totalIncome ?? 0)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted)] font-medium">
              مجموع هزینه بازه
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-red-400">
            {monthlyQ.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              formatToman(monthlyQ.data?.summary.totalExpense ?? 0)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[var(--muted)] font-medium">خالص</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-brand-400">
            {monthlyQ.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              formatToman(monthlyQ.data?.summary.totalNet ?? 0)
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>روند ماهانه درآمد و هزینه</CardTitle>
          <select
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
          >
            <option value={3}>۳ ماه</option>
            <option value={6}>۶ ماه</option>
            <option value={12}>۱۲ ماه</option>
          </select>
        </CardHeader>
        <CardContent>
          {monthlyQ.isLoading ? <Skeleton className="h-[280px] w-full" /> : null}
          {monthlyQ.error ? (
            <div className="text-[var(--muted)]">خطا در دریافت گزارش ماهانه.</div>
          ) : null}
          {monthlyQ.data ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyChart}>
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  formatter={(value) => formatToman(Number(value ?? 0))}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="income" name="درآمد" stroke="#06b6d4" strokeWidth={2} />
                <Line type="monotone" dataKey="expense" name="هزینه" stroke="#8b5cf6" strokeWidth={2} />
                <Line type="monotone" dataKey="net" name="خالص" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="text-sm text-[var(--muted)] flex-1">
          ماه تحلیل دسته‌ها
          <select
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5"
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
        <label className="text-sm text-[var(--muted)] flex-1">
          سال
          <input
            dir="ltr"
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2.5"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || current.year)}
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>هزینه به تفکیک دسته</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriesQ.isLoading ? <Skeleton className="h-[260px] w-full" /> : null}
            {categoriesQ.data && expensePie.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expensePie} dataKey="value" nameKey="name" outerRadius={90} label={false}>
                    {expensePie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : !categoriesQ.isLoading ? (
              <div className="h-[260px] flex items-center justify-center text-[var(--muted)] text-sm">
                هزینه‌ای در این ماه ثبت نشده است.
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>مقایسه دسته‌های هزینه</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriesQ.isLoading ? <Skeleton className="h-[260px] w-full" /> : null}
            {categoriesQ.data && (categoriesQ.data.expense?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={categoriesQ.data.expense.map((c) => ({
                    name: c.name,
                    amount: c.amount,
                  }))}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
                  <Bar dataKey="amount" name="مبلغ" fill="#ef4444" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : !categoriesQ.isLoading ? (
              <div className="h-[260px] flex items-center justify-center text-[var(--muted)] text-sm">
                داده‌ای برای نمودار نیست.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            بیشترین هزینه‌های {MONTH_LABELS[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {categoriesQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
          {(categoriesQ.data?.topExpenses ?? []).map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{tx.title}</div>
                <div className="text-xs text-[var(--muted)]">
                  {formatJalaliDate(tx.date)} · {tx.category} · {tx.account}
                </div>
              </div>
              <div className="text-red-400 font-semibold whitespace-nowrap">
                {formatToman(tx.amount)}
              </div>
            </div>
          ))}
          {!categoriesQ.isLoading && (categoriesQ.data?.topExpenses?.length ?? 0) === 0 ? (
            <div className="text-[var(--muted)] text-sm text-center py-6">
              هزینه‌ای برای نمایش وجود ندارد.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
