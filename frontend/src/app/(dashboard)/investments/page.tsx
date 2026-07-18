"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Col,
  Flex,
  Grid,
  Input,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  CalculatorOutlined,
  DeleteOutlined,
  DollarOutlined,
  EditOutlined,
  FundOutlined,
  LineChartOutlined,
  PlusOutlined,
  SwapOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  createInvestment,
  deleteInvestment,
  fetchInvestments,
  sellInvestment,
  updateInvestment,
  type GoldKind,
  type Investment,
  type InvestmentAssetType,
  type ProfitFrequency,
  type ProfitMode,
} from "@/services/investments";
import { fetchAccounts } from "@/services/accounts";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import {
  InvestmentsListSkeleton,
  KpiRowSkeleton,
} from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { AssetCalculator } from "@/components/investments/AssetCalculator";
import {
  MarketPriceTicker,
  type MarketTickerData,
} from "@/components/dashboard/MarketPriceTicker";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import type { ReactNode } from "react";
import api from "@/services/api";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { AppModal } from "@/components/ui/modal";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { AmountText } from "@/components/ui/amount-text";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";

const { Text } = Typography;

type PageTab = "investments" | "calculator";

const assetOptions = [
  { value: "gold" as const, label: "طلا" },
  { value: "usd" as const, label: "دلار" },
  { value: "rial" as const, label: "ریال" },
];

const goldKindOptions = [
  { value: "melted" as const, label: "طلا (آب شده/پارسیان)" },
  { value: "quarter_coin" as const, label: "ربع سکه" },
];

const profitModeOptions = [
  { value: "percent" as const, label: "درصد از مقدار اصلی" },
  { value: "fixed" as const, label: "مقدار ثابت" },
];

const frequencyOptions = [
  { value: "monthly" as const, label: "ماهانه" },
  { value: "daily" as const, label: "روزانه" },
  { value: "yearly" as const, label: "سالانه" },
];

function DetailRow({
  label,
  value,
  amountTone,
}: {
  label: string;
  value: ReactNode;
  amountTone?: "default" | "income" | "expense" | "brand" | "muted";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <Text type="secondary" className="shrink-0 text-xs">
        {label}
      </Text>
      {amountTone && typeof value === "string" ? (
        <AmountText tone={amountTone} size="sm" className="text-end">
          {value}
        </AmountText>
      ) : (
        <Text strong className="min-w-0 text-end text-sm tabular-nums">
          {value}
        </Text>
      )}
    </div>
  );
}

function assetUnitLabel(type: InvestmentAssetType, goldKind?: GoldKind | null): string {
  if (type === "usd") return "دلار";
  if (type === "rial") return "تومان";
  if (goldKind === "quarter_coin") return "تعداد";
  return "گرم";
}

function assetDisplayLabel(type: InvestmentAssetType, goldKind?: GoldKind | null): string {
  if (type === "usd") return "دلار";
  if (type === "rial") return "ریال";
  if (goldKind === "quarter_coin") return "ربع سکه";
  return "طلا (آب شده/پارسیان)";
}

function assetTagColor(type: InvestmentAssetType, goldKind?: GoldKind | null): string {
  if (type === "usd") return "blue";
  if (type === "rial") return "green";
  if (goldKind === "quarter_coin") return "orange";
  return "gold";
}

export default function InvestmentsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<PageTab>("investments");

  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState<InvestmentAssetType>("gold");
  const [goldKind, setGoldKind] = useState<GoldKind>("melted");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const [accountId, setAccountId] = useState("");
  const [hasProfit, setHasProfit] = useState(false);
  const [profitMode, setProfitMode] = useState<ProfitMode>("percent");
  const [profitValue, setProfitValue] = useState("");
  const [profitFrequency, setProfitFrequency] = useState<ProfitFrequency>("monthly");
  const [profitNextDate, setProfitNextDate] = useState("");
  const [profitEndDate, setProfitEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [sellTarget, setSellTarget] = useState<Investment | null>(null);
  const [sellQty, setSellQty] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState("");
  const [sellAccountId, setSellAccountId] = useState("");
  const [sellNotes, setSellNotes] = useState("");

  const unitLabel = assetUnitLabel(assetType, goldKind);

  const q = useQuery({
    queryKey: ["investments"],
    queryFn: fetchInvestments,
    enabled: tab === "investments",
  });

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    enabled: tab === "investments",
  });

  const effectiveAccountId = accountId || selectedAccountId || accountsQ.data?.[0]?.id || "";

  const marketQ = useQuery({
    queryKey: ["market-prices"],
    queryFn: async () => {
      try {
        return (await api.get("/api/market-prices")).data.data as MarketTickerData;
      } catch (err: unknown) {
        const ax = err as { response?: { data?: { message?: string } } };
        const msg = ax.response?.data?.message;
        throw new Error(msg || (err instanceof Error ? err.message : "خطا در دریافت قیمت‌ها"));
      }
    },
    staleTime: 60_000,
    refetchInterval: (q) => (q.state.data?.stale ? 2 * 60_000 : false),
    retry: 1,
  });

  const tickerError =
    marketQ.error instanceof Error
      ? marketQ.error.message
      : marketQ.data?.errors?.gold || marketQ.data?.errors?.currency;

  const previewProfitQty = useMemo(() => {
    const qty = parseAmountInput(quantity);
    const val = parseAmountInput(profitValue);
    if (!hasProfit || !Number.isFinite(qty) || !Number.isFinite(val) || val <= 0) return null;
    if (profitMode === "fixed") return val;
    return (qty * val) / 100;
  }, [hasProfit, quantity, profitValue, profitMode]);

  const resetForm = () => {
    setTitle("");
    setAssetType("gold");
    setGoldKind("melted");
    setQuantity("");
    setPurchasePrice("");
    setPurchaseDate("");
    setAccountId("");
    setHasProfit(false);
    setProfitMode("percent");
    setProfitValue("");
    setProfitFrequency("monthly");
    setProfitNextDate("");
    setProfitEndDate("");
    setNotes("");
    setEditingId(null);
  };

  function cancelEdit() {
    resetForm();
    setFormOpen(false);
  }

  function openCreate() {
    resetForm();
    setFormOpen(true);
  }

  function openEdit(item: Investment) {
    setEditingId(item.id);
    setTitle(item.title);
    setAssetType(item.assetType);
    setGoldKind(item.goldKind ?? "melted");
    setQuantity(String(item.quantity));
    setPurchasePrice(String(item.purchasePricePerUnit));
    setPurchaseDate(item.purchaseDate);
    setHasProfit(item.hasProfit);
    setProfitMode(item.profitMode ?? "percent");
    setProfitValue(item.profitValue != null ? String(item.profitValue) : "");
    setProfitFrequency(item.profitFrequency ?? "monthly");
    setProfitNextDate(item.profitNextDate || "");
    setProfitEndDate(item.profitEndDate || "");
    setNotes(item.notes || "");
    setAccountId("");
    setFormOpen(true);
  }

  const isEditing = Boolean(editingId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const qty = parseAmountInput(quantity);
      const price =
        assetType === "rial" ? 1 : parseAmountInput(purchasePrice);
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("مقدار معتبر نیست");
      if (
        assetType === "gold" &&
        goldKind === "quarter_coin" &&
        (!Number.isInteger(qty) || qty < 1)
      ) {
        throw new Error("تعداد ربع سکه باید عدد صحیح باشد");
      }
      if (assetType !== "rial" && (!Number.isFinite(price) || price <= 0)) {
        throw new Error("قیمت خرید معتبر نیست");
      }
      if (!purchaseDate.trim()) throw new Error("تاریخ خرید را وارد کنید");
      if (!effectiveAccountId) throw new Error("حساب بانکی خرید را انتخاب کنید");
      if (assetType === "gold" && !goldKind) throw new Error("نوع طلا را انتخاب کنید");

      const payload: Parameters<typeof createInvestment>[0] = {
        title: title.trim(),
        assetType,
        goldKind: assetType === "gold" ? goldKind : null,
        quantity: qty,
        purchasePricePerUnit: price,
        purchaseDate: normalizeJalaliDateInput(purchaseDate),
        hasProfit,
        notes: notes.trim() || null,
        accountId: effectiveAccountId,
      };

      if (hasProfit) {
        const pVal = parseAmountInput(profitValue);
        if (!Number.isFinite(pVal) || pVal <= 0) throw new Error("مقدار سود را وارد کنید");
        if (!profitNextDate.trim()) throw new Error("تاریخ پرداخت سود را وارد کنید");
        payload.profitMode = profitMode;
        payload.profitValue = pVal;
        payload.profitFrequency = profitFrequency;
        payload.profitNextDate = normalizeJalaliDateInput(profitNextDate);
        payload.profitEndDate = profitEndDate
          ? normalizeJalaliDateInput(profitEndDate)
          : null;
      }

      return createInvestment(payload);
    },
    onSuccess: () => {
      message.success(
        hasProfit
          ? "سرمایه‌گذاری ثبت شد؛ مبلغ خرید از حساب کم شد و سود در سررسیدها اضافه شد"
          : "سرمایه‌گذاری ثبت شد و مبلغ خرید از حساب کم شد"
      );
      resetForm();
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره");
      message.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) throw new Error("مورد ویرایش مشخص نیست");
      const qty = parseAmountInput(quantity);
      const price =
        assetType === "rial" ? 1 : parseAmountInput(purchasePrice);
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("مقدار معتبر نیست");
      if (
        assetType === "gold" &&
        goldKind === "quarter_coin" &&
        (!Number.isInteger(qty) || qty < 1)
      ) {
        throw new Error("تعداد ربع سکه باید عدد صحیح باشد");
      }
      if (assetType !== "rial" && (!Number.isFinite(price) || price <= 0)) {
        throw new Error("قیمت خرید معتبر نیست");
      }
      if (!purchaseDate.trim()) throw new Error("تاریخ خرید را وارد کنید");
      if (hasProfit && !profitNextDate.trim()) {
        throw new Error("تاریخ پرداخت سود را وارد کنید");
      }

      return updateInvestment(editingId, {
        title: title.trim(),
        quantity: qty,
        purchasePricePerUnit: price,
        purchaseDate: normalizeJalaliDateInput(purchaseDate),
        notes: notes.trim() || null,
        ...(hasProfit
          ? {
              profitNextDate: normalizeJalaliDateInput(profitNextDate),
              profitEndDate: profitEndDate
                ? normalizeJalaliDateInput(profitEndDate)
                : null,
            }
          : {}),
      });
    },
    onSuccess: () => {
      message.success("ویرایش ذخیره شد؛ تراکنش خرید مرتبط هم به‌روز شد");
      resetForm();
      setFormOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ویرایش");
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInvestment(id),
    onSuccess: () => {
      message.success("حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف";
      message.error(msg);
    },
  });

  const effectiveSellAccountId =
    sellAccountId || selectedAccountId || accountsQ.data?.[0]?.id || "";

  function openSell(item: Investment) {
    setSellTarget(item);
    setSellQty(
      item.assetType === "gold" && item.goldKind === "quarter_coin"
        ? String(item.quantity)
        : String(item.quantity)
    );
    setSellPrice(
      item.assetType === "rial"
        ? "1"
        : item.currentUnitPrice != null
          ? String(item.currentUnitPrice)
          : String(item.purchasePricePerUnit)
    );
    setSellDate("");
    setSellAccountId(selectedAccountId || "");
    setSellNotes("");
  }

  function closeSell() {
    setSellTarget(null);
    setSellQty("");
    setSellPrice("");
    setSellDate("");
    setSellAccountId("");
    setSellNotes("");
  }

  const sellMutation = useMutation({
    mutationFn: async () => {
      if (!sellTarget) throw new Error("مورد فروش مشخص نیست");
      const qty = parseAmountInput(sellQty);
      const price =
        sellTarget.assetType === "rial" ? 1 : parseAmountInput(sellPrice);
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("مقدار فروش معتبر نیست");
      if (qty > sellTarget.quantity + 1e-9) {
        throw new Error("مقدار فروش بیشتر از موجودی است");
      }
      if (
        sellTarget.assetType === "gold" &&
        sellTarget.goldKind === "quarter_coin" &&
        (!Number.isInteger(qty) || qty < 1)
      ) {
        throw new Error("تعداد ربع سکه باید عدد صحیح باشد");
      }
      if (sellTarget.assetType !== "rial" && (!Number.isFinite(price) || price <= 0)) {
        throw new Error("قیمت فروش معتبر نیست");
      }
      if (!sellDate.trim()) throw new Error("تاریخ فروش را وارد کنید");
      if (!effectiveSellAccountId) throw new Error("حساب واریز فروش را انتخاب کنید");

      return sellInvestment(sellTarget.id, {
        quantity: qty,
        salePricePerUnit: price,
        saleDate: normalizeJalaliDateInput(sellDate),
        accountId: effectiveSellAccountId,
        notes: sellNotes.trim() || null,
      });
    },
    onSuccess: (data) => {
      const pnl = data.sold.realizedPnl;
      message.success(
        pnl === 0
          ? `${formatToman(data.sold.proceeds)} به حساب واریز شد`
          : `${formatToman(data.sold.proceeds)} واریز شد · سود/زیان ${formatToman(pnl)}`
      );
      closeSell();
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در فروش");
      message.error(msg);
    },
  });

  const summary = q.data?.summary;
  const items = q.data?.items ?? [];
  const sellUnitLabel = sellTarget
    ? assetUnitLabel(sellTarget.assetType, sellTarget.goldKind)
    : "";
  const sellPreviewProceeds = useMemo(() => {
    if (!sellTarget) return null;
    const qty = parseAmountInput(sellQty);
    const price =
      sellTarget.assetType === "rial" ? 1 : parseAmountInput(sellPrice);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return null;
    return Math.round(qty * price);
  }, [sellTarget, sellQty, sellPrice]);

  return (
    <PageShell>
      <MarketPriceTicker
        market={marketQ.data}
        loading={marketQ.isLoading}
        errorMessage={tickerError}
      />

      <PageHeader
        title="سرمایه‌گذاری / پس‌انداز"
        icon={<FundOutlined />}
        description="طلا، دلار و ریال جدا از حساب بانکی — ارزش روز، سود دوره‌ای و محاسبه‌گر"
        actions={
          tab === "investments" ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              افزودن
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <FilterField className="sm:min-w-[14rem] sm:flex-[2]">
          <Segmented
            block
            value={tab}
            onChange={(v) => setTab(v as PageTab)}
            options={[
              {
                value: "investments",
                label: "سرمایه‌گذاری‌ها",
                icon: <FundOutlined />,
              },
              {
                value: "calculator",
                label: "محاسبه‌گر طلا / دلار",
                icon: <CalculatorOutlined />,
              },
            ]}
          />
        </FilterField>
      </FilterBar>

      {tab === "calculator" ? <AssetCalculator /> : null}

      {tab === "investments" && q.isLoading ? (
        <div className="space-y-4">
          <KpiRowSkeleton
            count={3}
            colProps={{ xs: 24, sm: 8 }}
            gutter={[16, 16]}
          />
          <InvestmentsListSkeleton />
        </div>
      ) : null}

      {tab === "investments" && q.error ? (
        <QueryError
          message="خطا در دریافت سرمایه‌گذاری‌ها."
          onRetry={() => void q.refetch()}
        />
      ) : null}

      {tab === "investments" && q.isSuccess ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <KpiCard
                label="ارزش فعلی"
                value={
                  summary?.totalValue != null ? formatToman(summary.totalValue) : "—"
                }
                tone="brand"
                icon={<WalletOutlined />}
              />
            </Col>
            <Col xs={24} sm={8}>
              <KpiCard
                label="هزینه خرید"
                value={formatToman(summary?.totalCost ?? 0)}
                tone="violet"
                icon={<DollarOutlined />}
              />
            </Col>
            <Col xs={24} sm={8}>
              <KpiCard
                label="سود / زیان"
                value={
                  summary?.totalUnrealizedPnl != null
                    ? formatToman(summary.totalUnrealizedPnl)
                    : "—"
                }
                tone={
                  summary?.totalUnrealizedPnl != null && summary.totalUnrealizedPnl >= 0
                    ? "success"
                    : summary?.totalUnrealizedPnl != null
                      ? "danger"
                      : "default"
                }
                icon={<LineChartOutlined />}
              />
            </Col>
          </Row>

          <AppModal
            open={formOpen}
            onClose={cancelEdit}
            title={isEditing ? "ویرایش سرمایه‌گذاری" : "افزودن سرمایه‌گذاری"}
            width={640}
            footer={
              <Flex gap="small" justify="end" wrap="wrap">
                <Button onClick={cancelEdit}>انصراف</Button>
                <Button
                  type="primary"
                  loading={createMutation.isPending || updateMutation.isPending}
                  onClick={() =>
                    isEditing ? updateMutation.mutate() : createMutation.mutate()
                  }
                >
                  {isEditing ? "ذخیره تغییرات" : "ذخیره"}
                </Button>
              </Flex>
            }
          >
            <Flex vertical gap="middle">
              {isEditing ? (
                <Text type="secondary" className="text-xs">
                  تغییر مقدار یا قیمت خرید، مبلغ تراکنش «خرید» مرتبط را هم اصلاح می‌کند. برای نقد
                  شدن از دکمه فروش استفاده کنید.
                </Text>
              ) : null}

              <Input
                placeholder="عنوان (مثلاً طلای خونه)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} sm={assetType === "gold" ? 12 : 8}>
                  <Text type="secondary" className="text-xs">
                    نوع دارایی
                  </Text>
                  <Select
                    className="w-full"
                    value={assetType}
                    options={assetOptions}
                    disabled={isEditing}
                    onChange={(v: InvestmentAssetType) => {
                      setAssetType(v);
                      if (v === "gold") setGoldKind("melted");
                      if (v === "rial") setPurchasePrice("1");
                    }}
                  />
                </Col>
                {assetType === "gold" ? (
                  <Col xs={24} sm={12}>
                    <Text type="secondary" className="text-xs">
                      نوع طلا
                    </Text>
                    <Select
                      className="w-full"
                      value={goldKind}
                      options={goldKindOptions}
                      disabled={isEditing}
                      onChange={setGoldKind}
                    />
                  </Col>
                ) : null}
                <Col xs={24} sm={8}>
                  <Text type="secondary" className="text-xs">
                    {assetType === "rial"
                      ? "مبلغ (تومان)"
                      : assetType === "gold" && goldKind === "quarter_coin"
                        ? "تعداد ربع سکه"
                        : `مقدار (${unitLabel})`}
                  </Text>
                  <AmountInput
                    value={quantity}
                    onChange={setQuantity}
                    placeholder={
                      assetType === "rial"
                        ? "مثلاً ۱۰٬۰۰۰٬۰۰۰"
                        : goldKind === "quarter_coin"
                          ? "مثلاً ۲"
                          : "مثلاً ۴۲٫۹۸۰"
                    }
                    allowDecimals={
                      assetType !== "rial" &&
                      !(assetType === "gold" && goldKind === "quarter_coin")
                    }
                    decimalPlaces={
                      assetType === "gold" && goldKind === "quarter_coin"
                        ? 0
                        : assetType === "usd"
                          ? 2
                          : 3
                    }
                    showWords={false}
                  />
                </Col>
                {assetType !== "rial" ? (
                  <Col xs={24} sm={8}>
                    <Text type="secondary" className="text-xs">
                      {assetType === "gold" && goldKind === "quarter_coin"
                        ? "قیمت خرید هر ربع سکه (تومان)"
                        : `قیمت خرید هر ${unitLabel} (تومان)`}
                    </Text>
                    <AmountInput
                      value={purchasePrice}
                      onChange={setPurchasePrice}
                      placeholder="قیمت خرید"
                    />
                  </Col>
                ) : null}
              </Row>

              <div>
                <Text type="secondary" className="text-xs">
                  تاریخ خرید
                </Text>
                <JalaliDateInput value={purchaseDate} onChange={setPurchaseDate} />
              </div>

              {!isEditing ? (
                <div>
                  <Text type="secondary" className="text-xs">
                    حساب بانکی خرید (کسر نقد)
                  </Text>
                  <Select
                    className="mt-1 w-full"
                    value={effectiveAccountId || undefined}
                    onChange={setAccountId}
                    placeholder="انتخاب حساب"
                    options={(accountsQ.data ?? []).map((a) => ({
                      value: a.id,
                      label: `${a.name} · ${formatToman(a.balance)}`,
                    }))}
                  />
                </div>
              ) : null}

              {!isEditing ? (
                <Flex align="center" gap="middle">
                  <Switch checked={hasProfit} onChange={setHasProfit} />
                  <Text>سود دوره‌ای دارد</Text>
                </Flex>
              ) : null}

              {hasProfit ? (
                <SectionCard title="سود دوره‌ای" className="!shadow-none">
                  <Flex vertical gap="middle">
                    {!isEditing ? (
                      <Row gutter={[12, 12]}>
                        <Col xs={24} sm={8}>
                          <Text type="secondary" className="text-xs">
                            نوع سود
                          </Text>
                          <Select
                            className="w-full"
                            value={profitMode}
                            options={profitModeOptions}
                            onChange={setProfitMode}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Text type="secondary" className="text-xs">
                            {profitMode === "percent"
                              ? "درصد سود"
                              : `مقدار سود (${unitLabel})`}
                          </Text>
                          <AmountInput
                            value={profitValue}
                            onChange={setProfitValue}
                            placeholder={profitMode === "percent" ? "مثلاً ۲" : "مثلاً ۱٫۵"}
                            allowDecimals
                            decimalPlaces={profitMode === "percent" ? 2 : 3}
                            showWords={false}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Text type="secondary" className="text-xs">
                            دوره
                          </Text>
                          <Select
                            className="w-full"
                            value={profitFrequency}
                            options={frequencyOptions}
                            onChange={setProfitFrequency}
                          />
                        </Col>
                      </Row>
                    ) : (
                      <Text type="secondary" className="text-xs">
                        {profitMode === "percent"
                          ? `سود ${profitValue || "—"}٪ `
                          : `سود ثابت ${profitValue || "—"} ${unitLabel} `}
                        · {frequencyOptions.find((f) => f.value === profitFrequency)?.label}
                      </Text>
                    )}

                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={12}>
                        <Text type="secondary" className="text-xs">
                          تاریخ پرداخت سود
                        </Text>
                        <JalaliDateInput value={profitNextDate} onChange={setProfitNextDate} />
                      </Col>
                      <Col xs={24} sm={12}>
                        <Text type="secondary" className="text-xs">
                          تا چه تاریخی (اختیاری)
                        </Text>
                        <JalaliDateInput value={profitEndDate} onChange={setProfitEndDate} />
                      </Col>
                    </Row>

                    {!isEditing && previewProfitQty != null ? (
                      <Text type="secondary" className="text-xs">
                        هر دوره ≈{" "}
                        {previewProfitQty.toLocaleString("fa-IR", { maximumFractionDigits: 3 })}{" "}
                        {unitLabel} سود → در جریان دوره‌ای / سررسید‌ها به‌عنوان درآمد ثبت
                        می‌شود و مبلغ تومان با قیمت روز محاسبه می‌گردد.
                      </Text>
                    ) : null}
                  </Flex>
                </SectionCard>
              ) : null}

              <Input.TextArea
                rows={2}
                placeholder="یادداشت (اختیاری)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Flex>
          </AppModal>

          <AppModal
            open={Boolean(sellTarget)}
            onClose={closeSell}
            title={sellTarget ? `فروش «${sellTarget.title}»` : "فروش"}
            width={520}
            footer={
              <Flex gap="small" justify="end" wrap="wrap">
                <Button onClick={closeSell}>انصراف</Button>
                <Button
                  type="primary"
                  loading={sellMutation.isPending}
                  onClick={() => sellMutation.mutate()}
                >
                  تأیید فروش
                </Button>
              </Flex>
            }
          >
            {sellTarget ? (
              <Flex vertical gap="middle">
                <Text type="secondary" className="text-xs">
                  موجودی:{" "}
                  {sellTarget.assetType === "gold" && sellTarget.goldKind === "quarter_coin"
                    ? `${sellTarget.quantity.toLocaleString("fa-IR")} عدد`
                    : `${sellTarget.quantity.toLocaleString("fa-IR", {
                        maximumFractionDigits: 3,
                      })} ${sellUnitLabel}`}
                  {sellTarget.currentUnitPrice != null
                    ? ` · قیمت روز ≈ ${formatToman(sellTarget.currentUnitPrice)}`
                    : ""}
                </Text>

                <div>
                  <Text type="secondary" className="text-xs">
                    مقدار فروش ({sellUnitLabel})
                  </Text>
                  <AmountInput
                    value={sellQty}
                    onChange={setSellQty}
                    allowDecimals={
                      !(
                        sellTarget.assetType === "gold" &&
                        sellTarget.goldKind === "quarter_coin"
                      ) && sellTarget.assetType !== "rial"
                    }
                    decimalPlaces={
                      sellTarget.assetType === "gold" &&
                      sellTarget.goldKind === "quarter_coin"
                        ? 0
                        : sellTarget.assetType === "usd"
                          ? 2
                          : 3
                    }
                    showWords={false}
                  />
                  <Button
                    type="link"
                    size="small"
                    className="!px-0"
                    onClick={() => setSellQty(String(sellTarget.quantity))}
                  >
                    فروش همه
                  </Button>
                </div>

                {sellTarget.assetType !== "rial" ? (
                  <div>
                    <Text type="secondary" className="text-xs">
                      قیمت فروش هر {sellUnitLabel} (تومان)
                    </Text>
                    <AmountInput value={sellPrice} onChange={setSellPrice} placeholder="قیمت فروش" />
                  </div>
                ) : null}

                <div>
                  <Text type="secondary" className="text-xs">
                    تاریخ فروش
                  </Text>
                  <JalaliDateInput value={sellDate} onChange={setSellDate} />
                </div>

                <div>
                  <Text type="secondary" className="text-xs">
                    حساب واریز (ورود نقد)
                  </Text>
                  <Select
                    className="mt-1 w-full"
                    value={effectiveSellAccountId || undefined}
                    onChange={setSellAccountId}
                    placeholder="انتخاب حساب"
                    options={(accountsQ.data ?? []).map((a) => ({
                      value: a.id,
                      label: `${a.name} · ${formatToman(a.balance)}`,
                    }))}
                  />
                </div>

                <Input.TextArea
                  rows={2}
                  placeholder="یادداشت (اختیاری)"
                  value={sellNotes}
                  onChange={(e) => setSellNotes(e.target.value)}
                />

                {sellPreviewProceeds != null ? (
                  <Text>
                    مبلغ واریزی ≈ <Text strong>{formatToman(sellPreviewProceeds)}</Text>
                  </Text>
                ) : null}
              </Flex>
            ) : null}
          </AppModal>

          {items.length === 0 ? (
            <EmptyState title="هنوز سرمایه‌گذاری ثبت نشده" />
          ) : (
            <SoftList>
              {items.map((item) => (
                <SoftListItem key={item.id}>
                  <SoftListRow
                    title={
                      <Space wrap>
                        <span>{item.title}</span>
                        <Tag color={assetTagColor(item.assetType, item.goldKind)}>
                          {assetDisplayLabel(item.assetType, item.goldKind)}
                        </Tag>
                        {item.hasProfit ? <Tag color="green">سوددار</Tag> : null}
                      </Space>
                    }
                    trailing={
                      <Space size={0}>
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => openEdit(item)}
                          title="ویرایش"
                        >
                          {!isMobile ? "ویرایش" : null}
                        </Button>
                        <Button
                          type="text"
                          icon={<SwapOutlined />}
                          onClick={() => openSell(item)}
                          title="فروش"
                        >
                          {!isMobile ? "فروش" : null}
                        </Button>
                        <Popconfirm
                          title="حذف شود؟ (وجه خرید برنمی‌گردد — برای نقد شدن از فروش استفاده کنید)"
                          okText="بله"
                          cancelText="خیر"
                          onConfirm={() => deleteMutation.mutate(item.id)}
                        >
                          <Button
                            danger
                            type="text"
                            icon={<DeleteOutlined />}
                            loading={deleteMutation.isPending}
                          />
                        </Popconfirm>
                      </Space>
                    }
                    footer={
                      <div className="flex flex-col">
                        <DetailRow
                          label={
                            item.assetType === "gold" && item.goldKind === "quarter_coin"
                              ? "تعداد"
                              : "مقدار"
                          }
                          value={
                            item.assetType === "gold" && item.goldKind === "quarter_coin"
                              ? `${item.quantity.toLocaleString("fa-IR")} عدد ربع سکه`
                              : `${item.quantity.toLocaleString("fa-IR", {
                                  maximumFractionDigits: 3,
                                })} ${assetUnitLabel(item.assetType, item.goldKind)}`
                          }
                        />
                        <DetailRow
                          label="قیمت خرید"
                          value={formatToman(item.purchasePricePerUnit)}
                          amountTone="muted"
                        />
                        <DetailRow
                          label="ارزش فعلی"
                          value={item.currentValue != null ? formatToman(item.currentValue) : "—"}
                          amountTone="brand"
                        />
                        <DetailRow
                          label="سود / زیان"
                          value={
                            item.unrealizedPnl != null ? formatToman(item.unrealizedPnl) : "—"
                          }
                          amountTone={
                            item.unrealizedPnl != null && item.unrealizedPnl >= 0
                              ? "income"
                              : item.unrealizedPnl != null
                                ? "expense"
                                : undefined
                          }
                        />
                        <DetailRow
                          label="تاریخ خرید"
                          value={formatJalaliDate(item.purchaseDate)}
                        />
                        {item.hasProfit ? (
                          <>
                            <DetailRow
                              label="سود هر دوره"
                              value={`${item.profitAssetQuantity.toLocaleString("fa-IR", {
                                maximumFractionDigits: 3,
                              })} ${assetUnitLabel(item.assetType, item.goldKind)}${
                                item.profitTomanPerPeriod != null
                                  ? ` ≈ ${formatToman(item.profitTomanPerPeriod)}`
                                  : ""
                              }`}
                            />
                            <DetailRow
                              label="موعد سود"
                              value={
                                item.profitNextDate
                                  ? formatJalaliDate(item.profitNextDate)
                                  : "—"
                              }
                            />
                          </>
                        ) : null}
                      </div>
                    }
                  />
                </SoftListItem>
              ))}
            </SoftList>
          )}
        </>
      ) : null}
    </PageShell>
  );
}
