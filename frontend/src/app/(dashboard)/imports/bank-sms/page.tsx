"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
  Row,
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
import { confirmBankSms, previewBankSms, type ParsedImportItem } from "@/services/imports";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { formatToman, formatJalaliDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;
const { TextArea } = Input;

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

  const [rawText, setRawText] = useState("");
  const [accountId, setAccountId] = useState(selectedAccountId ?? "");
  const [jalaliYear, setJalaliYear] = useState(String(currentJalaliYearGuess()));
  const [items, setItems] = useState<ParsedImportItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [failedBlocks, setFailedBlocks] = useState<string[]>([]);
  const [syncBalance, setSyncBalance] = useState(true);
  const [previewMeta, setPreviewMeta] = useState<{
    bankHint: string;
    duplicateCount: number;
  } | null>(null);

  const effectiveAccountId = accountId || accountsQ.data?.[0]?.id || "";

  const previewMutation = useMutation({
    mutationFn: () =>
      previewBankSms({
        rawText,
        accountId: effectiveAccountId,
        jalaliYear: Number(jalaliYear),
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
      message.success(`${data.parsedCount} پیامک شناسایی شد`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در پردازش پیامک‌ها";
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
        selectedHashes,
        syncBalance,
      });
    },
    onSuccess: (data) => {
      message.success(`${data.importedCount} تراکنش وارد شد`);
      if (data.balanceSync) {
        message.info(
          `موجودی حساب همگام شد: ${formatToman(data.balanceSync.previousBalance)} → ${formatToman(data.balanceSync.balance)}`
        );
      }
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
    <Space orientation="vertical" size="large" className="w-full max-w-4xl">
      <div>
        <Title level={4} className="!m-0">
          <Space>
            <FileTextOutlined />
            ایمپورت پیامک بانکی
          </Space>
        </Title>
        <Text type="secondary">
          پیامک‌های بانک (پاسارگاد / ملی و ...) را Paste کنید. مبالغ به{" "}
          <Text strong>ریال</Text> هستند و خودکار به <Text strong>تومان</Text> تبدیل می‌شوند
          (÷۱۰). فرمت‌های ملی مثل انتقال، اصلاحیه، کارت و واریز پشتیبانی می‌شوند.
        </Text>
      </div>

      <Card>
        <Space orientation="vertical" size="middle" className="w-full">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={16}>
              <Text type="secondary">حساب مقصد</Text>
              {accountsQ.isLoading ? (
                <Skeleton className="h-11 w-full mt-2" rows={1} />
              ) : (
                <Select
                  className="w-full mt-2"
                  value={effectiveAccountId}
                  onChange={setAccountId}
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.bankName ? ` · ${a.bankName}` : ""}`,
                  }))}
                />
              )}
            </Col>

            <Col xs={24} md={8}>
              <Text type="secondary">سال شمسی (برای تاریخ‌های بدون سال)</Text>
              <Input
                className="mt-2"
                dir="ltr"
                value={jalaliYear}
                onChange={(e) => setJalaliYear(e.target.value)}
              />
            </Col>
          </Row>

          <div>
            <Text type="secondary">متن پیامک‌ها</Text>
            <TextArea
              className="mt-2 font-mono"
              dir="ltr"
              rows={10}
              placeholder={`مثال:\n777.888.12322409.1\n-9,500,000\n04/23_21:47\nمانده: 20,929,124`}
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
      </Card>

      {previewMeta ? (
        <Space wrap>
          {previewMeta.bankHint ? (
            <Tag color="cyan">بانک تشخیص‌داده‌شده: {previewMeta.bankHint}</Tag>
          ) : null}
          <Tag>تکراری: {previewMeta.duplicateCount}</Tag>
          <Tag color="blue">انتخاب‌شده برای ورود: {selectedCount}</Tag>
        </Space>
      ) : null}

      {items.length > 0 ? (
        <Space orientation="vertical" size="middle" className="w-full">
          <Flex justify="space-between" align="center" gap="small" wrap="wrap">
            <Title level={5} className="!m-0">
              پیش‌نمایش تراکنش‌ها
            </Title>
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

          <Space orientation="vertical" size="small" className="w-full">
            {items.map((item) => (
              <Card
                key={item.importHash}
                size="small"
                className={cn(
                  "w-full",
                  item.isDuplicate && "opacity-80 border-amber-400/30 bg-amber-500/5"
                )}
              >
                <Flex gap="middle" align="flex-start">
                  <Checkbox
                    disabled={item.isDuplicate}
                    checked={Boolean(selected[item.importHash])}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [item.importHash]: e.target.checked }))
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <Flex justify="space-between" align="center" gap="small" wrap="wrap">
                      <Space size="small" wrap>
                        <Tag color={item.type === "income" ? "green" : "red"}>
                          {item.type === "income" ? "واریز" : "برداشت"}
                        </Tag>
                        {item.bankName ? <Text strong>{item.bankName}</Text> : null}
                      </Space>
                      <Text
                        strong
                        className={cn(
                          item.type === "income" ? "text-emerald-500" : "text-red-500"
                        )}
                      >
                        {item.type === "income" ? "+" : "-"}
                        {formatToman(item.amount)}
                      </Text>
                    </Flex>
                    <Text type="secondary" className="text-sm">
                      {formatJalaliDate(item.date)}
                      {item.time ? ` · ${item.time}` : ""}
                      {item.balanceAfter !== undefined
                        ? ` · مانده ${formatToman(item.balanceAfter)}`
                        : ""}
                    </Text>
                    {item.isDuplicate ? (
                      <div className="mt-1">
                        <Tag icon={<WarningOutlined />} color="warning">
                          قبلاً ایمپورت شده — رد می‌شود
                        </Tag>
                      </div>
                    ) : (
                      <div className="mt-1">
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          آماده ورود · نیاز به نام‌گذاری بعداً
                        </Tag>
                      </div>
                    )}
                  </div>
                </Flex>
              </Card>
            ))}
          </Space>

          <Checkbox checked={syncBalance} onChange={(e) => setSyncBalance(e.target.checked)}>
            همگام‌سازی موجودی حساب با آخرین «مانده» پیامک در این دسته
          </Checkbox>

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
        </Space>
      ) : null}

      {failedBlocks.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={`${failedBlocks.length} بلوک قابل parse نبود`}
          description={
            <Space orientation="vertical" size="small" className="w-full">
              {failedBlocks.slice(0, 3).map((b, i) => (
                <pre
                  key={i}
                  className="m-0 text-xs whitespace-pre-wrap p-2 rounded-xl border border-slate-400/20"
                >
                  {b}
                </pre>
              ))}
            </Space>
          }
        />
      ) : null}
    </Space>
  );
}
