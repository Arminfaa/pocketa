"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Flex,
  Input,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { deleteBudget, fetchBudgets, upsertBudget } from "@/services/budgets";
import { fetchCategories } from "@/services/categories";
import { formatToman } from "@/lib/format";
import { parseAmountInput } from "@/lib/amount";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { AmountInput } from "@/components/ui/amount-input";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

export default function BudgetsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const current = getJalaliMonthYear();
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const budgetsQ = useQuery({
    queryKey: ["budgets", month, year],
    queryFn: () => fetchBudgets({ month, year }),
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const expenseCategories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === "expense"),
    [categoriesQ.data]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = parseAmountInput(amount);
      if (!categoryId) throw new Error("دسته را انتخاب کنید");
      if (!Number.isFinite(value) || value <= 0) throw new Error("مبلغ معتبر نیست");
      return upsertBudget({ categoryId, amount: value, month, year });
    },
    onSuccess: () => {
      message.success("بودجه ذخیره شد");
      setAmount("");
      setCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره بودجه");
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      message.success("بودجه حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف بودجه";
      message.error(msg);
    },
  });

  const items = budgetsQ.data?.items ?? [];
  const summary = budgetsQ.data?.summary;

  return (
    <Space orientation="vertical" size="large" className="w-full max-w-3xl">
      <div>
        <Title level={4} className="!m-0">
          بودجه‌بندی
        </Title>
        <Text type="secondary">برای هر دسته هزینه سقف ماهانه تعیین کنید و مصرف را ببینید.</Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={8}>
          <Text type="secondary">ماه</Text>
          <Select
            className="w-full mt-2"
            value={month}
            onChange={setMonth}
            options={MONTH_LABELS.map((label, idx) => ({
              value: idx + 1,
              label,
            }))}
          />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Text type="secondary">سال</Text>
          <Input
            className="mt-2"
            dir="ltr"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || current.year)}
          />
        </Col>
      </Row>

      {summary ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="کل بودجه" value={formatToman(summary.totalBudget)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="مصرف‌شده" value={formatToman(summary.totalConsumed)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="هشدارها"
                value={`${summary.warningCount} نزدیک · ${summary.dangerCount} رد شده`}
                className="[&_.ant-statistic-content-value]:text-base"
              />
            </Card>
          </Col>
        </Row>
      ) : null}

      {(summary?.warningCount ?? 0) + (summary?.dangerCount ?? 0) > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title="بعضی بودجه‌ها به سقف نزدیک شده‌اند یا از آن رد شده‌اند. هزینه‌های این ماه را بررسی کنید."
        />
      ) : null}

      <Card
        title={
          <Space>
            <PlusOutlined />
            تنظیم / به‌روزرسانی بودجه
          </Space>
        }
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Text type="secondary">دسته هزینه</Text>
              <Select
                className="w-full mt-2"
                placeholder="انتخاب کنید"
                value={categoryId || undefined}
                onChange={setCategoryId}
                options={expenseCategories.map((c) => ({
                  value: c._id,
                  label: c.name,
                }))}
              />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary">سقف ماهانه (تومان)</Text>
              <div className="mt-2">
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  placeholder="۳٬۰۰۰٬۰۰۰"
                />
              </div>
            </Col>
          </Row>
          <Button
            type="primary"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره بودجه"}
          </Button>
        </Space>
      </Card>

      {budgetsQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {budgetsQ.error ? (
        <QueryError message="خطا در دریافت بودجه‌ها." onRetry={() => void budgetsQ.refetch()} />
      ) : null}

      <Row gutter={[12, 12]}>
        {items.map((b) => {
          const statusColor =
            b.status === "danger" ? "red" : b.status === "warning" ? "orange" : "blue";
          const progressColor =
            b.status === "danger" ? "#ef4444" : b.status === "warning" ? "#f59e0b" : "#06b6d4";
          const statusLabel =
            b.status === "danger"
              ? "از سقف رد شده"
              : b.status === "warning"
                ? "نزدیک به سقف (۸۰٪+)"
                : "در محدوده";

          return (
            <Col key={b.id} xs={24} md={12}>
              <Card
                className={cn(
                  b.status === "danger" && "border-red-400/40",
                  b.status === "warning" && "border-amber-500/40"
                )}
              >
                <Flex justify="space-between" align="center" gap="small">
                  <Flex align="center" gap="small" className="min-w-0 flex-1 mb-3">
                    <div
                      className="w-7 h-7 rounded-xl shrink-0"
                      style={{ background: b.category?.color ?? "#06b6d4" }}
                    />
                    <Text strong ellipsis>
                      {b.category?.name ?? "دسته"}
                    </Text>
                  </Flex>
                  <Popconfirm
                    title="حذف بودجه"
                    description="این بودجه حذف شود؟"
                    okText="حذف"
                    cancelText="انصراف"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutate(b.id)}
                  >
                    <Button
                      type="default"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteMutation.isPending}
                      aria-label="حذف"
                    />
                  </Popconfirm>
                </Flex>

                <Flex justify="space-between" className="mt-3" wrap="wrap" gap="small">
                  <Text type="secondary">مصرف: {formatToman(b.consumed)}</Text>
                  <Text type="secondary">سقف: {formatToman(b.amount)}</Text>
                </Flex>
                <Flex wrap="wrap" gap="small" align="center" className="mt-1">
                  <Text type="secondary" className="text-xs">
                    باقیمانده: {formatToman(b.remaining)} · {b.rawPercent.toFixed(0)}%
                  </Text>
                  <Tag color={statusColor}>{statusLabel}</Tag>
                </Flex>

                <Progress
                  percent={b.percent}
                  showInfo={false}
                  strokeColor={progressColor}
                  className="mt-2"
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      {!budgetsQ.isLoading && items.length === 0 ? (
        <EmptyState
          title={`بودجه‌ای برای ${MONTH_LABELS[month - 1]} ${year} ثبت نشده`}
          description="برای دسته‌های هزینه سقف ماهانه تعریف کنید."
        />
      ) : null}
    </Space>
  );
}
