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
import { DeleteOutlined, FundOutlined, PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { deleteBudget, fetchBudgets, upsertBudget } from "@/services/budgets";
import { fetchCategories } from "@/services/categories";
import { formatToman } from "@/lib/format";
import { parseAmountInput } from "@/lib/amount";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { AmountInput } from "@/components/ui/amount-input";
import { BudgetsListSkeleton, KpiRowSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftAvatar, SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { cn } from "@/lib/cn";

const { Text } = Typography;

export default function BudgetsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const current = getJalaliMonthYear();
  const [month, setMonth] = useState(current.month);
  const [year, setYear] = useState(current.year);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const budgetsQ = useQuery({
    queryKey: ["budgets", month, year, selectedAccountId],
    queryFn: () => fetchBudgets({ month, year, accountId: selectedAccountId }),
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
      setFormOpen(false);
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
    <PageShell width="form">
      <PageHeader
        icon={<FundOutlined />}
        title="بودجه‌بندی"
        description="برای هر دسته هزینه سقف ماهانه تعیین کنید و مصرف را ببینید."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setFormOpen((o) => !o)}
            aria-label={formOpen ? "بستن فرم" : "افزودن بودجه"}
          />
        }
        extra={
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
              <Text type="secondary">سال</Text>
              <Input
                className="mt-2"
                dir="ltr"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || current.year)}
              />
            </Col>
          </Row>
        }
      />

      {budgetsQ.isLoading ? (
        <KpiRowSkeleton count={3} colProps={{ xs: 24, md: 8 }} />
      ) : summary ? (
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

      {formOpen ? (
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
      ) : null}

      {budgetsQ.isLoading ? <BudgetsListSkeleton /> : null}
      {budgetsQ.error ? (
        <QueryError message="خطا در دریافت بودجه‌ها." onRetry={() => void budgetsQ.refetch()} />
      ) : null}

      {!budgetsQ.isLoading && items.length === 0 ? (
        <EmptyState
          title={`بودجه‌ای برای ${MONTH_LABELS[month - 1]} ${year} ثبت نشده`}
          description="برای دسته‌های هزینه سقف ماهانه تعریف کنید."
        />
      ) : items.length > 0 ? (
        <SoftList>
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
              <SoftListItem
                key={b.id}
                className={cn(
                  b.status === "danger" && "bg-red-500/5",
                  b.status === "warning" && "bg-amber-500/5"
                )}
              >
                <SoftListRow
                  leading={
                    <SoftAvatar
                      color={b.category?.color ?? "#06b6d4"}
                      className="!h-7 !w-7 !rounded-xl"
                    />
                  }
                  title={b.category?.name ?? "دسته"}
                  subtitle={
                    <Flex wrap="wrap" gap="small" align="center">
                      <Text type="secondary" className="text-xs">
                        مصرف: {formatToman(b.consumed)} · سقف: {formatToman(b.amount)}
                      </Text>
                      <Tag color={statusColor} className="!m-0">
                        {statusLabel}
                      </Tag>
                    </Flex>
                  }
                  trailing={
                    <div className="text-left">
                      <Text type="secondary" className="text-xs">
                        باقیمانده
                      </Text>
                      <div>
                        <Text strong className="tabular-nums">
                          {formatToman(b.remaining)}
                        </Text>
                      </div>
                      <Text type="secondary" className="text-xs tabular-nums">
                        {b.rawPercent.toFixed(0)}%
                      </Text>
                    </div>
                  }
                  footer={
                    <Flex align="center" gap="small" wrap="wrap">
                      <Progress
                        percent={b.percent}
                        showInfo={false}
                        strokeColor={progressColor}
                        className="!mb-0 flex-1 min-w-[120px]"
                      />
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
                  }
                />
              </SoftListItem>
            );
          })}
        </SoftList>
      ) : null}
    </PageShell>
  );
}
