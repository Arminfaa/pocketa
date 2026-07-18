"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Flex,
  Grid,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { fetchAccounts } from "@/services/accounts";
import {
  confirmBankSms,
  previewBankSms,
  type ImportParseMode,
  type ParsedImportItem,
} from "@/services/imports";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { formatToman, formatJalaliDate } from "@/lib/format";
import { Sk } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { SectionCard } from "@/components/ui/section-card";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { AmountText } from "@/components/ui/amount-text";

const { Text } = Typography;
const { TextArea } = Input;

const SMS_PLACEHOLDER = `پیامک بانکی پاسارگاد / ملی را اینجا Paste کنید…
(مبالغ پیامک معمولاً ریال‌اند و به تومان تبدیل می‌شوند)`;

const RECEIPT_PLACEHOLDER = `رسید کارت به کارت
 وضعیت تراکنش: موفق
 کارت مقصد: 1234 - ∗∗∗∗ - ∗∗56 - 6037
 نام مقصد: نام خانوادگی مقصد
 مبلغ: 1,000,000تومان
شماره پیگیری: 123456
شماره ارجاع: 98765432101
کارت مبدا: 4321 - ∗∗∗∗ - ∗∗78 - 5022
نام مبدا: نام خانوادگی مبدا
تاریخ و ساعت: 12:00:00 1405/01/01
`;

function currentJalaliYearGuess(): number {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value ?? "1405";
    return Number(y.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  } catch {
    return 1405;
  }
}

export default function BankSmsImportPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const [mode, setMode] = useState<ImportParseMode>("sms");
  const [rawText, setRawText] = useState("");
  const [accountId, setAccountId] = useState(selectedAccountId ?? "");
  const [jalaliYear, setJalaliYear] = useState(String(currentJalaliYearGuess()));
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [failedBlocks, setFailedBlocks] = useState<string[]>([]);
  const [previewMeta, setPreviewMeta] = useState<{
    bankHint: string;
    duplicateCount: number;
  } | null>(null);

  const effectiveAccountId = accountId || accountsQ.data?.[0]?.id || "";
  const isReceiptMode = mode === "card_receipt";

  function resetPreview() {
    setItems([]);
    setSelected({});
    setFailedBlocks([]);
    setPreviewMeta(null);
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      previewBankSms({
        rawText,
        accountId: effectiveAccountId,
        jalaliYear: Number(jalaliYear),
        mode,
      }),
    onSuccess: (data) => {
      setItems(data.items);
      setFailedBlocks(data.failedBlocks);
      setPreviewMeta({ bankHint: data.bankHint, duplicateCount: data.duplicateCount });
      const next: Record<string, boolean> = {};
      for (const item of data.items) {
        next[item.importHash] = !item.isDuplicate;
      }
      setSelected(next);
      message.success(
        isReceiptMode
          ? `${data.parsedCount} رسید شناسایی شد`
          : `${data.parsedCount} پیامک شناسایی شد`
      );
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در پردازش متن";
      message.error(msg);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      const selectedHashes = items
        .filter((i) => selected[i.importHash] && !i.isDuplicate)
        .map((i) => i.importHash);
      return confirmBankSms({
        rawText,
        accountId: effectiveAccountId,
        jalaliYear: Number(jalaliYear),
        mode,
        selectedHashes,
      });
    },
    onSuccess: (data) => {
      message.success(`${data.importedCount} تراکنش وارد شد`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      router.push("/review");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره ایمپورت";
      message.error(msg);
    },
  });

  const selectedCount = useMemo(
    () => items.filter((i) => selected[i.importHash] && !i.isDuplicate).length,
    [items, selected]
  );

  return (
    <PageShell width="wide">
      <PageHeader
        title="ایمپورت بانکی"
        icon={<FileTextOutlined />}
        description={
          isReceiptMode ? (
            <>
              ساختار <Text strong>رسید کارت‌به‌کارت</Text> را Paste کنید. جهت واریز/برداشت از{" "}
              <Text strong>نام مبدا/مقصد</Text> نسبت به نام پروفایل شما تشخیص داده می‌شود. برای
              برداشت، <Text strong>کارمزد</Text> در مرحله <Text strong>نام‌گذاری</Text> اجباری است
              و به مبلغ انتقال اضافه می‌شود.
            </>
          ) : (
            <>
              پیامک بانکی (پاسارگاد / ملی) را Paste کنید. مبالغ پیامک معمولاً ریال‌اند و به تومان
              تبدیل می‌شوند؛ بعد از ورود در صفحه نام‌گذاری عنوان بگذارید.
            </>
          )
        }
      />

      <SectionCard title="ورود متن">
        <Space orientation="vertical" size="middle" className="w-full">
          <Segmented
            block
            value={mode}
            onChange={(value) => {
              setMode(value as ImportParseMode);
              resetPreview();
            }}
            options={[
              { label: "پیامک‌ها", value: "sms" },
              { label: "رسید انتقال وجه", value: "card_receipt" },
            ]}
          />

          <FilterBar className="!p-0 !shadow-none !bg-transparent !border-0">
            <FilterField label="حساب مقصد" className="sm:flex-[2]">
              {accountsQ.isLoading ? (
                <Sk className="h-11 w-full rounded-lg" />
              ) : (
                <Select
                  className="w-full"
                  value={effectiveAccountId}
                  onChange={setAccountId}
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.bankName ? ` · ${a.bankName}` : ""}`,
                  }))}
                />
              )}
            </FilterField>

            {!isReceiptMode ? (
              <FilterField label="سال شمسی (برای تاریخ‌های بدون سال)" className="sm:max-w-[10rem]">
                <Input
                  dir="ltr"
                  value={jalaliYear}
                  onChange={(e) => setJalaliYear(e.target.value)}
                />
              </FilterField>
            ) : null}
          </FilterBar>

          <div>
            <Text type="secondary" className="text-xs font-medium">
              {isReceiptMode ? "متن رسید(ها)" : "متن پیامک‌ها"}
            </Text>
            <TextArea
              className="mt-2 font-mono"
              dir="rtl"
              rows={12}
              placeholder={isReceiptMode ? RECEIPT_PLACEHOLDER : SMS_PLACEHOLDER}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
          </div>

          <Button
            type="primary"
            loading={previewMutation.isPending}
            disabled={rawText.trim().length < 10 || !effectiveAccountId}
            onClick={() => previewMutation.mutate()}
          >
            پیش‌نمایش
          </Button>
        </Space>
      </SectionCard>

      {previewMeta ? (
        <Space wrap>
          {previewMeta.bankHint ? (
            <Tag color="cyan">نوع تشخیص‌داده‌شده: {previewMeta.bankHint}</Tag>
          ) : null}
          <Tag>تکراری: {previewMeta.duplicateCount}</Tag>
          <Tag color="blue">انتخاب‌شده برای ورود: {selectedCount}</Tag>
        </Space>
      ) : null}

      {items.length > 0 ? (
        <>
          <SoftList
            header={
              <Flex justify="space-between" align="center" gap="small" wrap="wrap">
                <Text strong>پیش‌نمایش تراکنش‌ها</Text>
                <Space>
                  <Button
                    size="small"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      for (const item of items) {
                        next[item.importHash] = !item.isDuplicate;
                      }
                      setSelected(next);
                    }}
                  >
                    انتخاب همه
                  </Button>
                  <Button size="small" onClick={() => setSelected({})}>
                    هیچ‌کدام
                  </Button>
                </Space>
              </Flex>
            }
          >
            {items.map((item) => (
              <SoftListItem
                key={item.importHash}
                className={cn(item.isDuplicate && "bg-amber-500/5 opacity-80")}
              >
                <Flex gap="middle" align="flex-start">
                  <Checkbox
                    disabled={item.isDuplicate}
                    checked={Boolean(selected[item.importHash])}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [item.importHash]: e.target.checked }))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <SoftListRow
                      title={
                        <Space size="small" wrap>
                          <Tag color={item.type === "income" ? "green" : "red"}>
                            {item.type === "income" ? "واریز" : "برداشت"}
                          </Tag>
                          {item.bankName ? <Text strong>{item.bankName}</Text> : null}
                          {item.suggestedTitle ? <Text strong>{item.suggestedTitle}</Text> : null}
                        </Space>
                      }
                      subtitle={
                        <>
                          {formatJalaliDate(item.date)}
                          {item.time ? ` · ${item.time}` : ""}
                          {item.feeAmount && item.feeAmount > 0 ? (
                            <>
                              {" · "}
                              انتقال {formatToman(item.transferAmount ?? item.amount - item.feeAmount)}
                              {" + کارمزد "}
                              {formatToman(item.feeAmount)}
                            </>
                          ) : item.needsFee ? (
                            <> · کارمزد در نام‌گذاری</>
                          ) : null}
                        </>
                      }
                      trailing={
                        <AmountText
                          tone={item.type === "income" ? "income" : "expense"}
                          size="sm"
                          prefix={item.type === "income" ? "+" : "-"}
                          caption={
                            item.feeAmount && item.feeAmount > 0
                              ? "مبلغ + کارمزد"
                              : item.needsFee
                                ? "بدون کارمزد هنوز"
                                : undefined
                          }
                        >
                          {formatToman(item.amount)}
                        </AmountText>
                      }
                      footer={
                        item.isDuplicate ? (
                          <Tag icon={<WarningOutlined />} color="warning">
                            قبلاً ایمپورت شده — رد می‌شود
                          </Tag>
                        ) : (
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            {item.needsFee
                              ? "آماده ورود · نام‌گذاری + کارمزد اجباری"
                              : "آماده ورود · نیاز به نام‌گذاری بعداً"}
                          </Tag>
                        )
                      }
                    />
                  </div>
                </Flex>
              </SoftListItem>
            ))}
          </SoftList>

          <Button
            type="primary"
            block={isMobile}
            loading={confirmMutation.isPending}
            disabled={selectedCount === 0}
            onClick={() => confirmMutation.mutate()}
          >
            {isMobile
              ? `تأیید (${selectedCount})`
              : `تأیید و ورود ${selectedCount} تراکنش`}
          </Button>
        </>
      ) : null}

      {failedBlocks.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={`${failedBlocks.length} مورد قابل تشخیص نبود`}
          description={
            <Space orientation="vertical" size="small" className="w-full">
              {failedBlocks.slice(0, 3).map((b, i) => (
                <pre
                  key={i}
                  className="m-0 text-xs whitespace-pre-wrap p-2 rounded-xl bg-[color-mix(in_srgb,var(--muted)_8%,transparent)]"
                >
                  {b}
                </pre>
              ))}
            </Space>
          }
        />
      ) : null}
    </PageShell>
  );
}
