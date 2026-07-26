"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOpenOnQuery } from "@/hooks/use-open-on-query";
import {
  Alert,
  App,
  Button,
  Checkbox,
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
import {
  CaretRightOutlined,
  CheckSquareOutlined,
  DeleteOutlined,
  PieChartOutlined,
  PlusOutlined,
  AccountBookOutlined,
} from "@ant-design/icons";
import { RecurringPayModal } from "@/features/recurring/RecurringPayModal";
import {
  createRecurring,
  deleteRecurring,
  fetchRecurring,
  generateRecurring,
  type DebtEndMode,
  type DebtKind,
  type GenerateRecurringPayload,
  type RecurringItem,
} from "@/services/recurring";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/categories";
import type { Category } from "@/services/categories";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import {
  formatAmountInputValue,
  normalizeJalaliDateInput,
  parseAmountInput,
} from "@/lib/amount";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { RecurringListSkeleton } from "@/components/skeletons";
import { NumberInput } from "@/components/ui/number-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import {
  FinanceTypeToggle,
  financeTypeTextClass,
} from "@/components/ui/finance-type-toggle";
import {
  MarketUnitAmountInput,
  resolveMarketUnitTomanAmount,
  type AmountMarketUnit,
} from "@/components/ui/market-unit-amount-input";
import api from "@/services/api";
import { cn } from "@/lib/cn";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { AppModal } from "@/components/ui/modal";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { SectionCard } from "@/components/ui/section-card";
import { AmountText } from "@/components/ui/amount-text";
import { AmountInput } from "@/components/ui/amount-input";

const { Text } = Typography;

function kindLabel(kind: DebtKind, type: "income" | "expense"): string {
  if (kind === "one_time") return type === "income" ? "طلب یک‌باره" : "بدهی یک‌باره";
  return type === "income" ? "تکرارشونده (طلب)" : "تکرارشونده (قسط)";
}

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
  const [amountUnit, setAmountUnit] = useState<AmountMarketUnit>("toman");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [kind, setKind] = useState<DebtKind>("recurring");
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [multiStage, setMultiStage] = useState(false);
  const [stages, setStages] = useState<Array<{ day: number; amount: string }>>([
    { day: 1, amount: "" },
    { day: 15, amount: "" },
  ]);
  const [endMode, setEndMode] = useState<DebtEndMode>("forever");
  const [endMonths, setEndMonths] = useState<number | null>(12);
  const [dueDate, setDueDate] = useState(getTodayJalali());
  const [reminderHour, setReminderHour] = useState(20);
  const [categoryId, setCategoryId] = useState("");
  const [payItem, setPayItem] = useState<RecurringItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useOpenOnQuery("new", "1", "/recurring", () => setFormOpen(true));

  const listQ = useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });

  useEffect(() => {
    const focusId = searchParams.get("focus");
    if (!focusId || listQ.isLoading || !listQ.data) return;

    const exists = listQ.data.items.some((item) => item.id === focusId);
    router.replace("/recurring", { scroll: false });
    if (!exists) return;

    setFocusedId(focusId);
  }, [searchParams, listQ.isLoading, listQ.data, router]);

  useEffect(() => {
    if (!focusedId) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`recurring-${focusedId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const clearTimer = window.setTimeout(() => setFocusedId(null), 2500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(clearTimer);
    };
  }, [focusedId]);
  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
  });
  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const categories = useMemo(
    () => (categoriesQ.data ?? []).filter((c: Category) => c.type === type),
    [categoriesQ.data, type]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!categoryId) throw new Error("دسته را انتخاب کنید");

      let market: {
        gold: { gram18kToman: number | null } | null;
        currency: { usdFreeToman: number; usdtToman: number } | null;
      } | null = null;
      if (amountUnit !== "toman") {
        market = await queryClient.fetchQuery({
          queryKey: ["market-prices"],
          queryFn: async () => (await api.get("/api/market-prices")).data.data,
        });
      }

      const assetFieldsFrom = (
        resolved: ReturnType<typeof resolveMarketUnitTomanAmount>
      ) => {
        if ("error" in resolved) return {};
        if (resolved.assetQuantity != null && resolved.assetType) {
          return {
            assetQuantity: resolved.assetQuantity,
            assetType: resolved.assetType,
            goldKind: resolved.goldKind ?? null,
          };
        }
        return {};
      };

      if (kind === "recurring") {
        if (endMode === "months" && (!endMonths || endMonths < 1)) {
          throw new Error("تعداد ماه‌ها را وارد کنید");
        }

        if (multiStage) {
          if (amountUnit !== "toman") {
            throw new Error("پرداخت چندمرحله‌ای فقط با واحد تومان پشتیبانی می‌شود");
          }
          if (stages.length < 2) throw new Error("حداقل دو مرحله لازم است");
          const paymentDays = stages.map((s) => s.day);
          if (new Set(paymentDays).size !== paymentDays.length) {
            throw new Error("روزهای مراحل نباید تکراری باشند");
          }
          if (paymentDays.some((d) => d < 1 || d > 31)) {
            throw new Error("روز هر مرحله باید بین ۱ تا ۳۱ باشد");
          }

          const stageAmountsParsed = stages.map((s) =>
            Math.round(parseAmountInput(s.amount) || 0)
          );
          const hasAnyStageAmount = stageAmountsParsed.some((n) => n > 0);
          const allStageAmounts = stageAmountsParsed.every((n) => n > 0);

          let monthlyAmount = 0;
          let stageAmounts: number[] | undefined;

          if (hasAnyStageAmount) {
            if (!allStageAmounts) {
              throw new Error("مبلغ همه مراحل را وارد کنید یا همه را خالی بگذارید");
            }
            monthlyAmount = stageAmountsParsed.reduce((s, n) => s + n, 0);
            const sorted = paymentDays
              .map((day, i) => ({ day, amount: stageAmountsParsed[i]! }))
              .sort((a, b) => a.day - b.day);
            stageAmounts = sorted.map((s) => s.amount);
          } else {
            const resolved = resolveMarketUnitTomanAmount(amount, "toman", null);
            if ("error" in resolved) throw new Error(resolved.error);
            monthlyAmount = resolved.amount;
          }

          if (!(monthlyAmount > 0)) {
            throw new Error("مبلغ ماهانه یا مبلغ مراحل را وارد کنید");
          }

          const sortedDays = [...paymentDays].sort((a, b) => a - b);
          return createRecurring({
            title: title.trim(),
            amount: monthlyAmount,
            type,
            kind: "recurring",
            paymentDays: sortedDays,
            stageAmounts,
            endMode,
            endMonths: endMode === "months" ? endMonths : null,
            categoryId,
            reminderHour,
          });
        }

        const resolved = resolveMarketUnitTomanAmount(amount, amountUnit, market);
        if ("error" in resolved) throw new Error(resolved.error);
        if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) {
          throw new Error("روز موعد ماه را وارد کنید (۱ تا ۳۱)");
        }
        return createRecurring({
          title: title.trim(),
          amount: resolved.amount,
          type,
          kind: "recurring",
          dayOfMonth,
          endMode,
          endMonths: endMode === "months" ? endMonths : null,
          categoryId,
          reminderHour,
          ...assetFieldsFrom(resolved),
        });
      }

      const resolved = resolveMarketUnitTomanAmount(amount, amountUnit, market);
      if ("error" in resolved) throw new Error(resolved.error);
      const normalizedDue = normalizeJalaliDateInput(dueDate);
      if (!normalizedDue) throw new Error("تاریخ سررسید را وارد کنید");
      return createRecurring({
        title: title.trim(),
        amount: resolved.amount,
        type,
        kind: "one_time",
        dueDate: normalizedDue,
        categoryId,
        reminderHour,
        ...assetFieldsFrom(resolved),
      });
    },
    onSuccess: () => {
      message.success("بدهی/قسط ثبت شد");
      setTitle("");
      setAmount("");
      setAmountUnit("toman");
      setCategoryId("");
      setMultiStage(false);
      setStages([
        { day: 1, amount: "" },
        { day: 15, amount: "" },
      ]);
      setFormOpen(false);
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
    mutationFn: ({ id, payload }: { id: string; payload: GenerateRecurringPayload }) =>
      generateRecurring(id, payload),
    onSuccess: (data) => {
      message.success(data.message ?? "عملیات انجام شد");
      setPayItem(null);
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
  const { remainingDebts, remainingIncome } = useMemo(() => {
    let debts = 0;
    let income = 0;
    for (const item of monthChecklist) {
      if (item.paidThisMonth) continue;
      if (item.type === "expense") debts += item.amount;
      else income += item.amount;
    }
    return { remainingDebts: debts, remainingIncome: income };
  }, [monthChecklist]);
  const defaultAccountId = accountsQ.data?.[0]?.id ?? "";

  function cancelEdit() {
    setTitle("");
    setAmount("");
    setAmountUnit("toman");
    setType("expense");
    setKind("recurring");
    setDayOfMonth(1);
    setMultiStage(false);
    setStages([
      { day: 1, amount: "" },
      { day: 15, amount: "" },
    ]);
    setEndMode("forever");
    setEndMonths(12);
    setDueDate(getTodayJalali());
    setReminderHour(20);
    setCategoryId("");
    setFormOpen(false);
  }

  return (
    <PageShell>
      <PageHeader
        title="جریان دوره‌ای / سررسید‌ها"
        icon={<AccountBookOutlined />}
        description="درآمد، سود، اقساط و بدهی‌های زمان‌بندی‌شده — حساب بانکی را موقع ثبت تراکنش انتخاب کنید."
        actions={
          <Space wrap>
            <Link href="/reports?tab=debts">
              <Button icon={<PieChartOutlined />}>گزارش بدهی/طلب</Button>
            </Link>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setFormOpen(true)}
            >
              افزودن
            </Button>
          </Space>
        }
      />

      {(listQ.data?.dueCount ?? 0) > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={`${listQ.data?.dueCount} مورد به موعد رسیده یا گذشته است.`}
        />
      ) : null}

      {monthChecklist.length > 0 ? (
        <SectionCard
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
          description="تیک‌نخورده‌ها با «ثبت تراکنش الان» تیک می‌خورند."
        >
          <Space orientation="vertical" size="small" className="w-full">
            {monthChecklist.map((item: RecurringItem) => (
              <Flex
                key={`check-${item.id}`}
                align="center"
                justify="space-between"
                gap="middle"
                className={cn(
                  "rounded-xl px-3 py-2",
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
                    {(item.stageCount ?? 1) > 1 && !item.paidThisMonth
                      ? ` (مرحله ${toPersianDigits(String((item.currentStageIndex ?? 0) + 1))}/${toPersianDigits(String(item.stageCount))})`
                      : ""}
                  </span>
                </Checkbox>
                <AmountText
                  tone={item.type === "income" ? "income" : "expense"}
                  size="sm"
                  className={cn(item.paidThisMonth && "opacity-60")}
                >
                  {formatToman(item.amount)}
                </AmountText>
              </Flex>
            ))}
            <div className="mt-1 space-y-2 border-t border-app-border/60 pt-3">
              <Flex align="center" justify="space-between" gap="middle">
                <Text type="secondary" className="text-sm">
                  جمع بدهی‌های مانده
                </Text>
                <AmountText tone="expense" size="sm">
                  {formatToman(remainingDebts)}
                </AmountText>
              </Flex>
              <Flex align="center" justify="space-between" gap="middle">
                <Text type="secondary" className="text-sm">
                  جمع درآمد مانده و موجودی
                </Text>
                <AmountText tone="income" size="sm">
                  {formatToman(remainingIncome)}
                </AmountText>
              </Flex>
            </div>
          </Space>
        </SectionCard>
      ) : null}

      <AppModal
        open={formOpen}
        onClose={cancelEdit}
        title="افزودن مورد جدید"
        width={640}
        footer={
          <Flex gap="small" justify="end" wrap="wrap">
            <Button onClick={cancelEdit}>انصراف</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              ذخیره
            </Button>
          </Flex>
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
            placeholder={
              kind === "one_time"
                ? type === "income"
                  ? "عنوان (مثلاً طلب از علی)"
                  : "عنوان (مثلاً بدهی به علی)"
                : type === "income"
                  ? "عنوان (مثلاً سود ماهانه)"
                  : "عنوان (مثلاً قسط وام)"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Text type="secondary" className="mb-1 block text-xs">
                {type === "income" ? "نوع طلب" : "نوع بدهی"}
              </Text>
              <Select
                className="w-full"
                value={kind}
                onChange={setKind}
                options={[
                  {
                    value: "recurring",
                    label:
                      type === "income"
                        ? "تکرارشونده (طلب ماهانه)"
                        : "تکرارشونده (قسط ماهانه)",
                  },
                  {
                    value: "one_time",
                    label: type === "income" ? "طلب یک‌باره" : "بدهی یک‌باره",
                  },
                ]}
              />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary" className="mb-1 block text-xs">
                مبلغ
              </Text>
              <MarketUnitAmountInput
                value={amount}
                onChange={setAmount}
                unit={amountUnit}
                onUnitChange={setAmountUnit}
                inputClassName={cn(financeTypeTextClass(type))}
              />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary" className="mb-1 block text-xs">
                دسته‌بندی
              </Text>
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
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary" className="mb-1 block text-xs">
                ساعت یادآوری پوش (۳ روز قبل)
              </Text>
              <Select
                className="w-full"
                value={reminderHour}
                onChange={setReminderHour}
                options={HOUR_OPTIONS}
              />
            </Col>

            {kind === "recurring" ? (
              <>
                <Col xs={24}>
                  <Checkbox
                    checked={multiStage}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMultiStage(on);
                      if (on && amountUnit !== "toman") setAmountUnit("toman");
                      if (on && stages.every((s) => !s.amount) && amount) {
                        const monthly = Math.round(parseAmountInput(amount) || 0);
                        if (monthly > 0) {
                          const half = Math.floor(monthly / 2);
                          setStages([
                            { day: 1, amount: formatAmountInputValue(half) },
                            {
                              day: 15,
                              amount: formatAmountInputValue(monthly - half),
                            },
                          ]);
                        }
                      }
                    }}
                  >
                    پرداخت چندمرحله‌ای داخل ماه
                  </Checkbox>
                  <Text type="secondary" className="mt-1 block text-xs">
                    مناسب حقوق دو‌قسمتی؛ هر مرحله روز و مبلغ جدا دارد.
                  </Text>
                </Col>

                {multiStage ? (
                  <Col xs={24}>
                    <Space orientation="vertical" size="small" className="w-full">
                      {stages.map((stage, index) => (
                        <Flex key={index} gap="small" align="start" wrap="wrap">
                          <div className="w-28">
                            <Text type="secondary" className="mb-1 block text-xs">
                              روز مرحله {toPersianDigits(String(index + 1))}
                            </Text>
                            <NumberInput
                              className="!w-full"
                              min={1}
                              max={31}
                              value={stage.day}
                              onChange={(v) =>
                                setStages((prev) =>
                                  prev.map((s, i) =>
                                    i === index ? { ...s, day: v ?? 1 } : s
                                  )
                                )
                              }
                            />
                          </div>
                          <div className="min-w-[10rem] flex-1">
                            <Text type="secondary" className="mb-1 block text-xs">
                              مبلغ مرحله (اختیاری)
                            </Text>
                            <AmountInput
                              value={stage.amount}
                              onChange={(v) =>
                                setStages((prev) =>
                                  prev.map((s, i) =>
                                    i === index ? { ...s, amount: v } : s
                                  )
                                )
                              }
                            />
                          </div>
                          {stages.length > 2 ? (
                            <Button
                              className="mt-5"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                setStages((prev) => prev.filter((_, i) => i !== index))
                              }
                            />
                          ) : null}
                        </Flex>
                      ))}
                      {stages.length < 6 ? (
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            setStages((prev) => [...prev, { day: 20, amount: "" }])
                          }
                        >
                          افزودن مرحله
                        </Button>
                      ) : null}
                      <Text type="secondary" className="text-xs">
                        اگر مبلغ مراحل خالی باشد، مبلغ ماهانه بالا به‌صورت مساوی تقسیم
                        می‌شود.
                      </Text>
                    </Space>
                  </Col>
                ) : (
                  <Col xs={24} md={12}>
                    <Text type="secondary" className="mb-1 block text-xs">
                      روز موعد هر ماه
                    </Text>
                    <Space.Compact className="w-full">
                      <NumberInput
                        className="!w-full"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(v) => setDayOfMonth(v ?? 1)}
                      />
                      <Input className="!w-[7.5rem]" value="ام هر ماه" disabled />
                    </Space.Compact>
                  </Col>
                )}

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
                      <NumberInput
                        className="!w-full"
                        min={1}
                        max={600}
                        value={endMonths}
                        onChange={setEndMonths}
                      />
                      <Input className="!w-16" value="ماه" disabled />
                    </Space.Compact>
                  </Col>
                ) : null}
              </>
            ) : (
              <Col xs={24} md={12}>
                <Text type="secondary" className="mb-1 block text-xs">
                  تاریخ سررسید
                </Text>
                <JalaliDateInput
                  value={dueDate}
                  onChange={setDueDate}
                  placeholder="1405/04/25"
                />
              </Col>
            )}
          </Row>
        </Space>
      </AppModal>

      {listQ.isLoading ? <RecurringListSkeleton /> : null}
      {listQ.error ? (
        <QueryError
          message="خطا در دریافت جریان دوره‌ای / سررسید‌ها."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && items.length > 0 ? (
        <SoftList>
          {items.map((item: RecurringItem) => {
            const categoryName =
              typeof item.category === "object" && item.category ? item.category.name : "—";
            const scheduleText =
              item.kind === "recurring"
                ? (item.stageCount ?? item.paymentDays?.length ?? 1) > 1
                  ? `${toPersianDigits(String(item.stageCount ?? item.paymentDays!.length))} مرحله در ماه (${(item.paymentDays ?? []).map((d) => `${toPersianDigits(String(d))}ام`).join("، ")})`
                  : item.dayOfMonth != null
                    ? `${toPersianDigits(String(item.dayOfMonth))}ام هر ماه`
                    : `سررسید ${formatJalaliDate(item.nextPaymentDate)}`
                : `سررسید ${formatJalaliDate(item.nextPaymentDate)}`;

            const stageHint =
              item.kind === "recurring" &&
              (item.stageCount ?? 1) > 1 &&
              item.currentStageIndex != null
                ? ` · مرحله ${toPersianDigits(String(item.currentStageIndex + 1))} از ${toPersianDigits(String(item.stageCount))}`
                : "";

            return (
              <SoftListItem
                key={item.id}
                id={`recurring-${item.id}`}
                className={cn(
                  item.isDue && "bg-amber-500/5",
                  focusedId === item.id &&
                    "bg-brand-500/15 ring-2 ring-inset ring-brand-500/40 transition-colors duration-500"
                )}
              >
                <SoftListRow
                  title={
                    <Space size="small" wrap>
                      <span>{item.title}</span>
                      <Tag>{kindLabel(item.kind, item.type)}</Tag>
                      {(item.stageCount ?? 1) > 1 ? (
                        <Tag color="blue">چندمرحله‌ای</Tag>
                      ) : null}
                      {item.isDue ? <Tag color="orange">سررسید شده</Tag> : null}
                    </Space>
                  }
                  subtitle={
                    <>
                      {scheduleText}
                      {stageHint} · {endLabel(item)} · موعد بعدی{" "}
                      {formatJalaliDate(item.nextPaymentDate)} · یادآور{" "}
                      {formatReminderHour(item.reminderHour ?? 20)} · {categoryName}
                    </>
                  }
                  trailing={
                    <AmountText
                      tone={item.type === "income" ? "income" : "expense"}
                      size="sm"
                      caption={
                        item.baseAmount != null && item.amount !== item.baseAmount
                          ? `پایه ${formatToman(item.baseAmount)}`
                          : undefined
                      }
                    >
                      {formatToman(item.amount)}
                    </AmountText>
                  }
                  footer={
                    <Flex
                      gap="small"
                      wrap="wrap"
                      vertical={isMobile}
                      className={cn(isMobile && "w-full")}
                    >
                      <Button
                        type="primary"
                        block={isMobile}
                        icon={<CaretRightOutlined />}
                        onClick={() => setPayItem(item)}
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
                  }
                />
              </SoftListItem>
            );
          })}
        </SoftList>
      ) : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="هنوز موردی ثبت نشده"
          description="درآمد دوره‌ای، قسط یا بدهی یک‌باره را اینجا تعریف کنید."
        />
      ) : null}

      <RecurringPayModal
        open={!!payItem}
        item={payItem}
        accounts={accountsQ.data ?? []}
        defaultAccountId={defaultAccountId}
        submitting={generateMutation.isPending}
        onClose={() => setPayItem(null)}
        onSubmit={(payload) => {
          if (!payItem) return;
          generateMutation.mutate({ id: payItem.id, payload });
        }}
      />
    </PageShell>
  );
}
