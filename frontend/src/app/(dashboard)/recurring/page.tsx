"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Grid,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CaretRightOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  BellOutlined,
  PlusOutlined,
  AccountBookOutlined,
} from "@ant-design/icons";
import {
  createRecurring,
  deleteRecurring,
  fetchRecurring,
  generateRecurring,
  type DebtEndMode,
  type DebtKind,
  type RecurringItem,
} from "@/services/recurring";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import type { Category } from "@/services/categories";
import type { BankAccount } from "@/types/account";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { enablePushNotifications, disablePushNotifications, fetchPushStatus } from "@/lib/push";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { AppModal } from "@/components/ui/modal";
import {
  FinanceTypeToggle,
  financeTypeTextClass,
} from "@/components/ui/finance-type-toggle";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

const KIND_LABEL: Record<DebtKind, string> = {
  recurring: "تکرارشونده (قسط)",
  one_time: "بدهی یک‌باره",
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${toPersianDigits(String(h).padStart(2, "0"))}:۰۰`,
}));

function endLabel(item: {
  kind: DebtKind;
  endMode: DebtEndMode | null;
  endMonths: number | null;
  paymentsMade: number;
}): string {
  if (item.kind === "one_time") return "یک‌باره";
  if (item.endMode === "months" && item.endMonths != null) {
    return `${toPersianDigits(String(item.paymentsMade))}/${toPersianDigits(String(item.endMonths))} قسط`;
  }
  return "همیشگی";
}

function formatReminderHour(hour: number): string {
  return `${toPersianDigits(String(hour).padStart(2, "0"))}:۰۰`;
}

export default function RecurringPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [kind, setKind] = useState<DebtKind>("recurring");
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [endMode, setEndMode] = useState<DebtEndMode>("forever");
  const [endMonths, setEndMonths] = useState<number | null>(12);
  const [dueDate, setDueDate] = useState(getTodayJalali());
  const [reminderHour, setReminderHour] = useState(20);
  const [categoryId, setCategoryId] = useState("");
  const [payItem, setPayItem] = useState<RecurringItem | null>(null);
  const [payAccountId, setPayAccountId] = useState("");

  const listQ = useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const pushStatusQ = useQuery({ queryKey: ["push-status"], queryFn: fetchPushStatus });

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c: Category) => c.type === type),
    [categoriesQ.data, type]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(/,/g, ""));
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(value) || value <= 0) throw new Error("مبلغ معتبر نیست");
      if (!categoryId) throw new Error("دسته را انتخاب کنید");

      if (kind === "recurring") {
        if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
          throw new Error("روز موعد ماه را وارد کنید (۱ تا ۳۱)");
        }
        if (endMode === "months" && (!endMonths || endMonths < 1)) {
          throw new Error("تعداد ماه‌ها را وارد کنید");
        }
        return createRecurring({
          title: title.trim(),
          amount: value,
          type,
          kind: "recurring",
          dayOfMonth,
          endMode,
          endMonths: endMode === "months" ? endMonths : null,
          categoryId,
          reminderHour,
        });
      }

      if (!dueDate.trim()) throw new Error("تاریخ سررسید را وارد کنید");
      return createRecurring({
        title: title.trim(),
        amount: value,
        type,
        kind: "one_time",
        dueDate,
        categoryId,
        reminderHour,
      });
    },
    onSuccess: () => {
      message.success("بدهی/قسط ثبت شد");
      setTitle("");
      setAmount("");
      setCategoryId("");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره";
      message.error(msg);
    },
  });

  const pushMutation = useMutation({
    mutationFn: enablePushNotifications,
    onSuccess: () => {
      message.success("یادآوری پوش روی این دستگاه فعال شد");
      void queryClient.invalidateQueries({ queryKey: ["push-status"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "فعال‌سازی پوش ناموفق بود");
    },
  });

  const pushDisableMutation = useMutation({
    mutationFn: disablePushNotifications,
    onSuccess: () => {
      message.success("پوش این دستگاه خاموش شد");
      void queryClient.invalidateQueries({ queryKey: ["push-status"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "خاموش کردن پوش ناموفق بود");
    },
  });

  const generateMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      generateRecurring(id, accountId),
    onSuccess: () => {
      message.success("تراکنش ثبت شد");
      setPayItem(null);
      setPayAccountId("");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ثبت تراکنش";
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecurring(id),
    onSuccess: () => {
      message.success("حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
  });

  const items = listQ.data?.items ?? [];
  const monthChecklist = listQ.data?.monthChecklist ?? [];
  const monthPaidCount = monthChecklist.filter((i: RecurringItem) => i.paidThisMonth).length;
  const defaultAccountId = accountsQ.data?.[0]?.id ?? "";

  return (
    <Space orientation="vertical" size="large" className="w-full max-w-full min-w-0">
      <div>
        <Title level={4} className="!m-0">
          <Space>
            <AccountBookOutlined />
            بدهی / اقساط
          </Space>
        </Title>
        <Text type="secondary">
          اقساط ماهانه یا بدهی یک‌باره را ثبت کنید؛ حساب بانکی را موقع ثبت تراکنش انتخاب کنید.
        </Text>
      </div>

      <Card size="small">
        <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
          <div className="min-w-0">
            <Text strong>
              <BellOutlined className="me-1" />
              یادآوری پوش
            </Text>
            <div>
              <Text type="secondary" className="text-xs">
                روی هر دستگاه جداگانه فعال کنید. از ۳ روز قبل موعد، در ساعت مشخص‌شده نوتیف می‌آید.
              </Text>
            </div>
          </div>
          {pushStatusQ.data?.thisDevice ? (
            <Space size="small" wrap>
              <Tag color="success">فعال روی این دستگاه</Tag>
              <Button
                size="small"
                loading={pushDisableMutation.isPending}
                onClick={() => pushDisableMutation.mutate()}
              >
                خاموش کردن
              </Button>
            </Space>
          ) : (
            <Button
              icon={<BellOutlined />}
              loading={pushMutation.isPending}
              onClick={() => pushMutation.mutate()}
              disabled={
                pushStatusQ.data?.configured === false ||
                pushStatusQ.data?.supported === false
              }
            >
              فعال‌سازی روی این دستگاه
            </Button>
          )}
        </Flex>
      </Card>

      {(listQ.data?.dueCount ?? 0) > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`${listQ.data?.dueCount} مورد به موعد رسیده یا گذشته است.`}
        />
      ) : null}

      {monthChecklist.length > 0 ? (
        <Card
          title={
            <Space>
              <CheckSquareOutlined />
              چک‌لیست این ماه
              {listQ.data?.monthLabel ? (
                <Text type="secondary" className="!text-sm font-normal">
                  ({toPersianDigits(listQ.data.monthLabel)})
                </Text>
              ) : null}
            </Space>
          }
          extra={
            <Text type="secondary" className="text-sm">
              {toPersianDigits(String(monthPaidCount))}/
              {toPersianDigits(String(monthChecklist.length))} پرداخت شده
            </Text>
          }
        >
          <Text type="secondary" className="mb-3 block text-xs">
            تیک‌نخورده‌ها با «ثبت تراکنش الان» تیک می‌خورند.
          </Text>
          <Space orientation="vertical" size="small" className="w-full">
            {monthChecklist.map((item: RecurringItem) => (
              <Flex
                key={`check-${item.id}`}
                align="center"
                justify="space-between"
                gap="middle"
                className={cn(
                  "rounded-lg px-2 py-1.5",
                  item.paidThisMonth ? "bg-emerald-500/5" : "bg-app-muted/30"
                )}
              >
                <Checkbox checked={item.paidThisMonth} disabled>
                  <span
                    className={cn(
                      item.paidThisMonth && "text-app-muted line-through"
                    )}
                  >
                    {item.title}
                  </span>
                </Checkbox>
                <Text
                  className={cn(
                    "shrink-0 text-sm font-semibold",
                    financeTypeTextClass(item.type),
                    item.paidThisMonth && "opacity-60"
                  )}
                >
                  {formatToman(item.amount)}
                </Text>
              </Flex>
            ))}
          </Space>
        </Card>
      ) : null}

      <Card
        title={
          <Space>
            <PlusOutlined />
            افزودن مورد جدید
          </Space>
        }
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <FinanceTypeToggle
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCategoryId("");
            }}
          />

          <Select
            className="w-full"
            value={kind}
            onChange={setKind}
            options={[
              { value: "recurring", label: "تکرارشونده (قسط ماهانه)" },
              { value: "one_time", label: "بدهی یک‌باره" },
            ]}
          />

          <Input
            placeholder={
              kind === "one_time" ? "عنوان (مثلاً بدهی به علی)" : "عنوان (مثلاً قسط وام)"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            dir="ltr"
            placeholder="مبلغ تومان"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn("font-semibold", financeTypeTextClass(type))}
          />

          {kind === "recurring" ? (
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Text type="secondary" className="mb-1 block text-xs">
                  روز موعد هر ماه
                </Text>
                <Space.Compact className="w-full">
                  <InputNumber
                    className="!w-full"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(v) => setDayOfMonth(v ?? 1)}
                  />
                  <Input className="!w-[7.5rem]" value="ام هر ماه" disabled />
                </Space.Compact>
              </Col>
              <Col xs={24} md={12}>
                <Text type="secondary" className="mb-1 block text-xs">
                  مدت تکرار
                </Text>
                <Select
                  className="w-full"
                  value={endMode}
                  onChange={setEndMode}
                  options={[
                    { value: "forever", label: "همیشگی (هر ماه)" },
                    { value: "months", label: "تا چند ماه مشخص" },
                  ]}
                />
              </Col>
              {endMode === "months" ? (
                <Col xs={24} md={12}>
                  <Text type="secondary" className="mb-1 block text-xs">
                    تعداد ماه‌ها
                  </Text>
                  <Space.Compact className="w-full">
                    <InputNumber
                      className="!w-full"
                      min={1}
                      max={600}
                      value={endMonths}
                      onChange={(v) => setEndMonths(v)}
                    />
                    <Input className="!w-16" value="ماه" disabled />
                  </Space.Compact>
                </Col>
              ) : null}
            </Row>
          ) : (
            <div>
              <Text type="secondary" className="mb-1 block text-xs">
                تاریخ سررسید
              </Text>
              <Input
                dir="ltr"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                placeholder="1405/04/25"
              />
            </div>
          )}

          <div>
            <Text type="secondary" className="mb-1 block text-xs">
              ساعت یادآوری پوش (۳ روز قبل از موعد)
            </Text>
            <Select
              className="w-full"
              value={reminderHour}
              onChange={setReminderHour}
              options={HOUR_OPTIONS}
            />
          </div>

          <Select
            className="w-full"
            placeholder="انتخاب دسته"
            value={categoryId || undefined}
            onChange={setCategoryId}
            options={categories.map((c: Category) => ({
              value: c._id,
              label: c.name,
            }))}
          />

          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "در حال ذخیره..." : "ثبت"}
          </Button>
        </Space>
      </Card>

      {listQ.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {listQ.error ? (
        <QueryError
          message="خطا در دریافت بدهی‌ها و اقساط."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((item: RecurringItem) => {
          const categoryName =
            typeof item.category === "object" && item.category ? item.category.name : "—";
          const scheduleText =
            item.kind === "recurring" && item.dayOfMonth != null
              ? `${toPersianDigits(String(item.dayOfMonth))}ام هر ماه`
              : `سررسید ${formatJalaliDate(item.nextPaymentDate)}`;

          return (
            <Card
              key={item.id}
              className={cn(item.isDue && "border-amber-500/40")}
            >
              <Flex
                justify="space-between"
                align="flex-start"
                gap="middle"
                wrap="wrap"
                vertical={isMobile}
              >
                <div className="min-w-0 flex-1 mb-3">
                  <Space size="small" wrap>
                    <Text strong>{item.title}</Text>
                    <Tag>{KIND_LABEL[item.kind] ?? item.kind}</Tag>
                    {item.isDue ? <Tag color="orange">سررسید شده</Tag> : null}
                  </Space>
                  <div>
                    <Text type="secondary" className="break-words">
                      {scheduleText} · {endLabel(item)} · موعد بعدی{" "}
                      {formatJalaliDate(item.nextPaymentDate)} · یادآور{" "}
                      {formatReminderHour(item.reminderHour ?? 20)} · {categoryName}
                    </Text>
                  </div>
                </div>
                <Text
                  strong
                  className={cn(financeTypeTextClass(item.type), "font-semibold")}
                >
                  {formatToman(item.amount)}
                </Text>
              </Flex>
              <Flex
                gap="small"
                wrap="wrap"
                vertical={isMobile}
                className={cn("mt-3", isMobile && "w-full")}
              >
                <Button
                  type="primary"
                  block={isMobile}
                  icon={<CaretRightOutlined />}
                  onClick={() => {
                    setPayItem(item);
                    setPayAccountId(defaultAccountId);
                  }}
                >
                  ثبت تراکنش الان
                </Button>
                <Popconfirm
                  title="حذف مورد"
                  description="حذف شود؟"
                  okText="حذف"
                  cancelText="انصراف"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutate(item.id)}
                >
                  <Button block={isMobile} danger icon={<DeleteOutlined />}>
                    حذف
                  </Button>
                </Popconfirm>
              </Flex>
            </Card>
          );
        })}
      </Space>

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="هنوز بدهی یا قسطی ثبت نشده"
          description="قسط ماهانه یا بدهی یک‌باره را اینجا تعریف کنید."
        />
      ) : null}

      <AppModal
        open={!!payItem}
        onClose={() => {
          setPayItem(null);
          setPayAccountId("");
        }}
        title="ثبت تراکنش"
        subtitle={payItem ? payItem.title : undefined}
        footer={
          <Flex gap="small" justify="flex-end" wrap="wrap">
            <Button
              onClick={() => {
                setPayItem(null);
                setPayAccountId("");
              }}
            >
              انصراف
            </Button>
            <Button
              type="primary"
              loading={generateMutation.isPending}
              onClick={() => {
                if (!payItem) return;
                const acc = payAccountId || defaultAccountId;
                if (!acc) {
                  message.error("حساب بانکی را انتخاب کنید");
                  return;
                }
                generateMutation.mutate({ id: payItem.id, accountId: acc });
              }}
            >
              ثبت تراکنش
            </Button>
          </Flex>
        }
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Text type="secondary">حساب بانکی که این پرداخت از آن انجام می‌شود را انتخاب کنید.</Text>
          <Select
            className="w-full"
            placeholder="انتخاب حساب بانکی"
            value={payAccountId || defaultAccountId || undefined}
            onChange={setPayAccountId}
            options={(accountsQ.data ?? []).map((a: BankAccount) => ({
              value: a.id,
              label: a.name,
            }))}
          />
        </Space>
      </AppModal>
    </Space>
  );
}
