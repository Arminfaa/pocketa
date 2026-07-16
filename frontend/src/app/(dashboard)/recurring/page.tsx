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
  Grid,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { CaretRightOutlined, DeleteOutlined, PlusOutlined, CalendarOutlined } from "@ant-design/icons";
import {
  createRecurring,
  deleteRecurring,
  fetchRecurring,
  generateRecurring,
} from "@/services/recurring";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import {
  FinanceTypeToggle,
  financeTypeTextClass,
} from "@/components/ui/finance-type-toggle";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

const FREQ_LABEL: Record<string, string> = {
  weekly: "هفتگی",
  monthly: "ماهانه",
  yearly: "سالانه",
};

export default function RecurringPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [nextPaymentDate, setNextPaymentDate] = useState(getTodayJalali());
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const listQ = useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c) => c.type === type),
    [categoriesQ.data, type]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(/,/g, ""));
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(value) || value <= 0) throw new Error("مبلغ معتبر نیست");
      const acc = accountId || accountsQ.data?.[0]?.id;
      if (!acc) throw new Error("حساب را انتخاب کنید");
      if (!categoryId) throw new Error("دسته را انتخاب کنید");
      return createRecurring({
        title: title.trim(),
        amount: value,
        type,
        frequency,
        nextPaymentDate,
        accountId: acc,
        categoryId,
      });
    },
    onSuccess: () => {
      message.success("پرداخت تکرارشونده ثبت شد");
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

  const generateMutation = useMutation({
    mutationFn: (id: string) => generateRecurring(id),
    onSuccess: () => {
      message.success("تراکنش ساخته شد و موعد بعدی جلو رفت");
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در تولید تراکنش";
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

  return (
    <Space orientation="vertical" size="large" className="w-full max-w-full min-w-0">
      <div>
        <Title level={4} className="!m-0">
          <Space>
            <CalendarOutlined />
            پرداخت‌های تکرارشونده
          </Space>
        </Title>
        <Text type="secondary">
          اجاره، اینترنت، حقوق و ... را ثبت کنید و در موعد با یک کلیک به تراکنش تبدیل کنید.
        </Text>
      </div>

      {(listQ.data?.dueCount ?? 0) > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`${listQ.data?.dueCount} مورد به موعد رسیده یا گذشته است.`}
        />
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

          <Input
            placeholder="عنوان (مثلاً اینترنت)"
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

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Select
                className="w-full"
                value={frequency}
                onChange={setFrequency}
                options={[
                  { value: "weekly", label: "هفتگی" },
                  { value: "monthly", label: "ماهانه" },
                  { value: "yearly", label: "سالانه" },
                ]}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                dir="ltr"
                value={nextPaymentDate}
                onChange={(e) => setNextPaymentDate(e.target.value)}
                placeholder="1405/04/01"
              />
            </Col>
            <Col xs={24} md={12}>
              <Select
                className="w-full"
                value={accountId || accountsQ.data?.[0]?.id || undefined}
                onChange={setAccountId}
                options={(accountsQ.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </Col>
            <Col xs={24} md={12}>
              <Select
                className="w-full"
                placeholder="انتخاب دسته"
                value={categoryId || undefined}
                onChange={setCategoryId}
                options={categories.map((c) => ({
                  value: c._id,
                  label: c.name,
                }))}
              />
            </Col>
          </Row>

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
          message="خطا در دریافت پرداخت‌های تکرارشونده."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((item) => {
          const accountName =
            typeof item.account === "object" && item.account ? item.account.name : "—";
          const categoryName =
            typeof item.category === "object" && item.category ? item.category.name : "—";
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
                  <Text strong>{item.title}</Text>
                  <div>
                    <Text type="secondary" className="break-words">
                      {FREQ_LABEL[item.frequency] ?? item.frequency} · موعد{" "}
                      {formatJalaliDate(item.nextPaymentDate)} · {accountName} · {categoryName}
                      {item.isDue ? (
                        <Tag color="orange" className="!ms-1">
                          سررسید شده
                        </Tag>
                      ) : null}
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
                  loading={generateMutation.isPending}
                  onClick={() => generateMutation.mutate(item.id)}
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
          title="هنوز پرداخت تکرارشونده‌ای ثبت نشده"
          description="اجاره، اینترنت یا حقوق را اینجا تعریف کنید."
        />
      ) : null}
    </Space>
  );
}
