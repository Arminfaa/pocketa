"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOpenOnQuery } from "@/hooks/use-open-on-query";
import {
  Alert,
  App,
  Button,
  Col,
  Flex,
  Input,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  FundOutlined,
  PlusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { deleteBudget, fetchBudgets, upsertBudget } from "@/services/budgets";
import { fetchCategories } from "@/services/categories";
import { formatToman, toPersianDigits } from "@/lib/format";
import { parseAmountInput } from "@/lib/amount";
import { getJalaliMonthYear, MONTH_LABELS } from "@/lib/finance-ui";
import { AmountInput } from "@/components/ui/amount-input";
import { AmountText } from "@/components/ui/amount-text";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import { AppModal } from "@/components/ui/modal";
import { BudgetsListSkeleton, KpiRowSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftAvatar, SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { cn } from "@/lib/cn";

const { Text } = Typography;

const actionBtnClass = "!rounded-xl";

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

  useOpenOnQuery("new", "1", "/budgets", () => setFormOpen(true));

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
  const alertCount = (summary?.warningCount ?? 0) + (summary?.dangerCount ?? 0);

  function cancelEdit() {
    setAmount("");
    setCategoryId("");
    setFormOpen(false);
  }

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
            onClick={() => setFormOpen(true)}
            aria-label="افزودن بودجه"
          />
        }
        extra={
          <FilterBar>
            <FilterField label="ماه" className="sm:max-w-[12rem]">
              <Select
                className="w-full"
                value={month}
                onChange={setMonth}
                options={MONTH_LABELS.map((label, idx) => ({
                  value: idx + 1,
                  label,
                }))}
              />
            </FilterField>
            <FilterField label="سال" className="sm:max-w-[8rem]">
              <Input
                dir="ltr"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || current.year)}
              />
            </FilterField>
          </FilterBar>
        }
      />

      {budgetsQ.isLoading ? (
        <KpiRowSkeleton count={3} colProps={{ xs: 24, md: 8 }} />
      ) : summary ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <KpiCard
              label="کل بودجه"
              value={formatToman(summary.totalBudget)}
              icon={<FundOutlined />}
              tone="brand"
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCard
              label="مصرف‌شده"
              value={formatToman(summary.totalConsumed)}
              tone="warning"
            />
          </Col>
          <Col xs={24} md={8}>
            <KpiCard
              label="هشدارها"
              value={`${toPersianDigits(String(summary.warningCount))} نزدیک · ${toPersianDigits(String(summary.dangerCount))} رد شده`}
              icon={<WarningOutlined />}
              tone={alertCount > 0 ? "danger" : "default"}
              size="sm"
            />
          </Col>
        </Row>
      ) : null}

      {alertCount > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title="بعضی بودجه‌ها به سقف نزدیک شده‌اند یا از آن رد شده‌اند. هزینه‌های این ماه را بررسی کنید."
        />
      ) : null}

      <AppModal
        open={formOpen}
        onClose={cancelEdit}
        title="تنظیم / به‌روزرسانی بودجه"
        subtitle={`برای ${MONTH_LABELS[month - 1]} ${toPersianDigits(String(year))}`}
        footer={
          <Flex gap="small" justify="end" wrap="wrap">
            <Button onClick={cancelEdit}>انصراف</Button>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              ذخیره
            </Button>
          </Flex>
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
        </Space>
      </AppModal>

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
        <SoftList
          header={
            <Text type="secondary" className="text-xs font-medium">
              {toPersianDigits(String(items.length))} بودجه · {MONTH_LABELS[month - 1]}{" "}
              {toPersianDigits(String(year))}
            </Text>
          }
        >
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
                    <AmountText
                      tone={
                        b.status === "danger"
                          ? "expense"
                          : b.status === "warning"
                            ? "default"
                            : "brand"
                      }
                      size="sm"
                      caption={`${toPersianDigits(b.rawPercent.toFixed(0))}٪`}
                    >
                      {formatToman(b.remaining)}
                    </AmountText>
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
                          size="small"
                          className={actionBtnClass}
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
