"use client";

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
import { formatToman } from "@/lib/format";

const tooltipStyle = {
  background: "var(--card)",
  border: "none",
  borderRadius: 16,
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.08)",
};

export function ReportsTrendLineChart({
  data,
  height,
  isMobile,
}: {
  data: { label: string; income: number; expense: number; net: number }[];
  height: number;
  isMobile: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <XAxis
          dataKey="label"
          angle={isMobile ? -35 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 60 : 30}
          tick={{ fontSize: isMobile ? 10 : 12 }}
        />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(value) => formatToman(Number(value ?? 0))}
          contentStyle={tooltipStyle}
        />
        <Legend />
        <Line type="monotone" dataKey="income" name="درآمد" stroke="#10b981" strokeWidth={2} />
        <Line type="monotone" dataKey="expense" name="هزینه" stroke="#ef4444" strokeWidth={2} />
        <Line type="monotone" dataKey="net" name="خالص" stroke="#22c55e" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ReportsMonthBarChart({
  data,
  height,
  isMobile,
}: {
  data: { name: string; income: number; expense: number }[];
  height: number;
  isMobile: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip
          formatter={(value) => formatToman(Number(value ?? 0))}
          contentStyle={tooltipStyle}
        />
        <Legend />
        <Bar dataKey="income" name="درآمد" fill="#10b981" radius={[8, 8, 0, 0]} />
        <Bar dataKey="expense" name="هزینه" fill="#ef4444" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportsExpensePieChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={90} label={false}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ReportsCategoryCompareChart({
  data,
  isMobile,
}: {
  data: { name: string; amount: number }[];
  isMobile: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          angle={isMobile ? -35 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 60 : 30}
          tick={{ fontSize: isMobile ? 10 : 11 }}
        />
        <YAxis tick={{ fontSize: 11 }} width={70} />
        <Tooltip formatter={(value) => formatToman(Number(value ?? 0))} />
        <Bar dataKey="amount" name="مبلغ" fill="#ef4444" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
