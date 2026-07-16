"use client";

import api from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import { formatToman } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { BarChart, Bar, Legend } from "recharts";
import { useAccountFilterStore } from "@/stores/account-filter.store";

export default function DashboardPage() {
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const dashboardQ = useQuery({
    queryKey: ["dashboard", selectedAccountId],
    queryFn: async () => {
      const qs = selectedAccountId ? `?accountId=${selectedAccountId}` : "";
      return (await api.get(`/api/dashboard${qs}`)).data.data;
    },
  });

  const monthlyQ = useQuery({
    queryKey: ["reports-monthly", selectedAccountId],
    queryFn: async () => {
      const qs = new URLSearchParams({ months: "6" });
      if (selectedAccountId) qs.set("accountId", selectedAccountId);
      return (await api.get(`/api/reports/monthly?${qs.toString()}`)).data.data;
    },
  });

  const categoriesQ = useQuery({
    queryKey: ["reports-categories", selectedAccountId],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (selectedAccountId) qs.set("accountId", selectedAccountId);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return (await api.get(`/api/reports/categories${suffix}`)).data.data;
    },
  });

  const dashboard = dashboardQ.data;

  if (dashboardQ.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-[var(--card)]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (dashboardQ.error) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--muted)]">
        خطا در دریافت اطلاعات داشبورد.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>موجودی فعلی</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatToman(dashboard.totals.balance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>درآمد این ماه</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatToman(dashboard.totals.incomeThisMonth)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>هزینه این ماه</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatToman(dashboard.totals.expenseThisMonth)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>درصد پس‌انداز</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{dashboard.totals.savingsPercent.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>نمودار درآمد و هزینه (۶ ماه اخیر)</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyQ.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : monthlyQ.data ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyQ.data.labels.map((label: string, i: number) => ({
                  label,
                  income: monthlyQ.data.income[i],
                  expense: monthlyQ.data.expense[i],
                }))}>
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="income" stroke="#06b6d4" name="درآمد" />
                  <Line type="monotone" dataKey="expense" stroke="#8b5cf6" name="هزینه" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[var(--muted)]">اطلاعات کافی نیست.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>بیشترین دسته‌های هزینه</CardTitle>
          </CardHeader>
          <CardContent>
            {categoriesQ.isLoading ? (
              <Skeleton className="h-[260px] w-full" />
            ) : categoriesQ.data ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={categoriesQ.data.expense.map((c: any) => ({
                    name: c.name,
                    amount: c.amount,
                  }))}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" fill="#ef4444" name="مبلغ" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-[var(--muted)]">اطلاعات کافی نیست.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

