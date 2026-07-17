"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { formatToman } from "@/lib/format";

type IncomeExpenseProps = {
  income: number;
  expense: number;
  height: number;
  tickFontSize: number;
};

export function DashboardIncomeExpenseChart({
  income,
  expense,
  height,
  tickFontSize,
}: IncomeExpenseProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={[
          {
            name: "این ماه",
            income,
            expense,
          },
        ]}
      >
        <XAxis dataKey="name" tick={{ fontSize: tickFontSize }} />
        <YAxis tick={{ fontSize: tickFontSize }} width={70} />
        <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
        <Legend />
        <Bar dataKey="income" fill="#10b981" name="درآمد" radius={[8, 8, 0, 0]} />
        <Bar dataKey="expense" fill="#ef4444" name="هزینه" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type CategoryBarProps = {
  data: { name: string; amount: number }[];
  height: number;
  isMobile: boolean;
};

export function DashboardCategoryBarChart({ data, height, isMobile }: CategoryBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          angle={isMobile ? -35 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 60 : 30}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} width={70} />
        <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
        <Legend />
        <Bar dataKey="amount" fill="#ef4444" name="مبلغ" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
