"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
  Statistic,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  FundOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  createInvestment,
  deleteInvestment,
  fetchInvestments,
  type InvestmentAssetType,
  type ProfitFrequency,
  type ProfitMode,
} from "@/services/investments";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";

const { Title, Text } = Typography;

const assetOptions = [
  { value: "gold" as const, label: "طلا (گرم)" },
  { value: "usd" as const, label: "دلار" },
];

const profitModeOptions = [
  { value: "percent" as const, label: "درصد از مقدار اصلی" },
  { value: "fixed" as const, label: "مقدار ثابت (گرم/دلار)" },
];

const frequencyOptions = [
  { value: "monthly" as const, label: "ماهانه" },
  { value: "daily" as const, label: "روزانه" },
  { value: "yearly" as const, label: "سالانه" },
];

function assetUnitLabel(type: InvestmentAssetType): string {
  return type === "gold" ? "گرم" : "دلار";
}

export default function InvestmentsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [assetType, setAssetType] = useState<InvestmentAssetType>("gold");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [hasProfit, setHasProfit] = useState(false);
  const [profitMode, setProfitMode] = useState<ProfitMode>("percent");
  const [profitValue, setProfitValue] = useState("");
  const [profitFrequency, setProfitFrequency] = useState<ProfitFrequency>("monthly");
  const [profitNextDate, setProfitNextDate] = useState("");
  const [profitEndDate, setProfitEndDate] = useState("");
  const [notes, setNotes] = useState("");

  const q = useQuery({ queryKey: ["investments"], queryFn: fetchInvestments });

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
    setQuantity("");
    setPurchasePrice("");
    setPurchaseDate("");
    setHasProfit(false);
    setProfitMode("percent");
    setProfitValue("");
    setProfitFrequency("monthly");
    setProfitNextDate("");
    setProfitEndDate("");
    setNotes("");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const qty = parseAmountInput(quantity);
      const price = parseAmountInput(purchasePrice);
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("مقدار معتبر نیست");
      if (!Number.isFinite(price) || price <= 0) throw new Error("قیمت خرید معتبر نیست");
      if (!purchaseDate.trim()) throw new Error("تاریخ خرید را وارد کنید");

      const payload: Parameters<typeof createInvestment>[0] = {
        title: title.trim(),
        assetType,
        quantity: qty,
        purchasePricePerUnit: price,
        purchaseDate: normalizeJalaliDateInput(purchaseDate),
        hasProfit,
        notes: notes.trim() || null,
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
          ? "سرمایه‌گذاری ثبت شد و درآمد سود در بدهی/اقساط اضافه شد"
          : "سرمایه‌گذاری ثبت شد"
      );
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ["investments"] });
      void queryClient.invalidateQueries({ queryKey: ["recurring"] });
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

  if (q.isLoading) {
    return (
      <Flex vertical gap="large">
        <Skeleton className="h-10 w-48" rows={1} />
        <Row gutter={[16, 16]}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Col key={i} xs={24} sm={8}>
              <Card>
                <Skeleton className="h-16 w-full" rows={1} />
              </Card>
            </Col>
          ))}
        </Row>
      </Flex>
    );
  }

  if (q.error) {
    return (
      <QueryError
        message="خطا در دریافت سرمایه‌گذاری‌ها."
        onRetry={() => void q.refetch()}
      />
    );
  }

  const summary = q.data?.summary;
  const items = q.data?.items ?? [];

  return (
    <Flex vertical gap="large">
      <div>
        <Title level={isMobile ? 4 : 3} className="!mb-1">
          <FundOutlined className="me-2" />
          سرمایه‌گذاری / پس‌انداز
        </Title>
        <Text type="secondary">
          طلا و دلار جدا از حساب بانکی — ارزش روز و سود دوره‌ای
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="ارزش فعلی"
              value={
                summary?.totalValue != null ? formatToman(summary.totalValue) : "—"
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="هزینه خرید" value={formatToman(summary?.totalCost ?? 0)} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="سود / زیان"
              value={
                summary?.totalUnrealizedPnl != null
                  ? formatToman(summary.totalUnrealizedPnl)
                  : "—"
              }
              className={
                summary?.totalUnrealizedPnl != null && summary.totalUnrealizedPnl >= 0
                  ? "[&_.ant-statistic-content-value]:text-emerald-500"
                  : summary?.totalUnrealizedPnl != null
                    ? "[&_.ant-statistic-content-value]:text-red-500"
                    : undefined
              }
            />
          </Card>
        </Col>
      </Row>

      <Card title="افزودن سرمایه‌گذاری">
        <Flex vertical gap="middle">
          <Input
            placeholder="عنوان (مثلاً طلای خونه)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={8}>
              <Text type="secondary" className="text-xs">
                نوع دارایی
              </Text>
              <Select
                className="w-full"
                value={assetType}
                options={assetOptions}
                onChange={setAssetType}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Text type="secondary" className="text-xs">
                مقدار ({assetUnitLabel(assetType)})
              </Text>
              <AmountInput value={quantity} onChange={setQuantity} placeholder="مثلاً ۵۰" />
            </Col>
            <Col xs={24} sm={8}>
              <Text type="secondary" className="text-xs">
                قیمت خرید هر {assetUnitLabel(assetType)} (تومان)
              </Text>
              <AmountInput
                value={purchasePrice}
                onChange={setPurchasePrice}
                placeholder="قیمت خرید"
              />
            </Col>
          </Row>

          <div>
            <Text type="secondary" className="text-xs">
              تاریخ خرید
            </Text>
            <JalaliDateInput value={purchaseDate} onChange={setPurchaseDate} />
          </div>

          <Flex align="center" gap="middle">
            <Switch checked={hasProfit} onChange={setHasProfit} />
            <Text>سود دوره‌ای دارد</Text>
          </Flex>

          {hasProfit ? (
            <Card size="small" className="bg-transparent">
              <Flex vertical gap="middle">
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
                        : `مقدار سود (${assetUnitLabel(assetType)})`}
                    </Text>
                    <AmountInput
                      value={profitValue}
                      onChange={setProfitValue}
                      placeholder={profitMode === "percent" ? "مثلاً ۲" : "مثلاً ۱"}
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

                {previewProfitQty != null ? (
                  <Text type="secondary" className="text-xs">
                    هر دوره ≈ {previewProfitQty.toLocaleString("fa-IR", { maximumFractionDigits: 3 })}{" "}
                    {assetUnitLabel(assetType)} سود → در بدهی/اقساط به‌عنوان درآمد ثبت می‌شود و
                    مبلغ تومان با قیمت روز محاسبه می‌گردد.
                  </Text>
                ) : null}
              </Flex>
            </Card>
          ) : null}

          <Input.TextArea
            rows={2}
            placeholder="یادداشت (اختیاری)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            ذخیره
          </Button>
        </Flex>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="هنوز سرمایه‌گذاری ثبت نشده" />
      ) : (
        <Flex vertical gap="middle">
          {items.map((item) => (
            <Card
              key={item.id}
              title={
                <Space wrap>
                  <span>{item.title}</span>
                  <Tag color={item.assetType === "gold" ? "gold" : "blue"}>
                    {item.assetType === "gold" ? "طلا" : "دلار"}
                  </Tag>
                  {item.hasProfit ? <Tag color="green">سوددار</Tag> : null}
                </Space>
              }
              extra={
                <Popconfirm
                  title="حذف شود؟"
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
              }
            >
              <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="مقدار"
                    value={`${item.quantity.toLocaleString("fa-IR")} ${assetUnitLabel(item.assetType)}`}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="قیمت خرید"
                    value={formatToman(item.purchasePricePerUnit)}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="ارزش فعلی"
                    value={item.currentValue != null ? formatToman(item.currentValue) : "—"}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Statistic
                    title="سود/زیان"
                    value={
                      item.unrealizedPnl != null ? formatToman(item.unrealizedPnl) : "—"
                    }
                    className={
                      item.unrealizedPnl != null && item.unrealizedPnl >= 0
                        ? "[&_.ant-statistic-content-value]:text-emerald-500"
                        : item.unrealizedPnl != null
                          ? "[&_.ant-statistic-content-value]:text-red-500"
                          : undefined
                    }
                  />
                </Col>
              </Row>

              <div className="mt-3">
                <Text type="secondary" className="text-xs">
                  خرید: {formatJalaliDate(item.purchaseDate)}
                  {item.hasProfit
                    ? ` · سود هر دوره: ${item.profitAssetQuantity.toLocaleString("fa-IR", {
                        maximumFractionDigits: 3,
                      })} ${assetUnitLabel(item.assetType)}${
                        item.profitTomanPerPeriod != null
                          ? ` ≈ ${formatToman(item.profitTomanPerPeriod)}`
                          : ""
                      } · موعد: ${item.profitNextDate ? formatJalaliDate(item.profitNextDate) : "—"}`
                    : ""}
                </Text>
              </div>
            </Card>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
