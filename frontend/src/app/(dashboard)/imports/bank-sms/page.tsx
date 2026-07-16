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
  Flex,
  Input,
  List,
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
    <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 896 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
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
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Flex gap="middle" wrap="wrap">
            <div style={{ flex: "1 1 200px" }}>
              <Text type="secondary">حساب مقصد</Text>
              {accountsQ.isLoading ? (
                <Skeleton className="h-11 w-full mt-2" rows={1} />
              ) : (
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  value={effectiveAccountId}
                  onChange={setAccountId}
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.bankName ? ` · ${a.bankName}` : ""}`,
                  }))}
                />
              )}
            </div>

            <div style={{ flex: "1 1 200px" }}>
              <Text type="secondary">سال شمسی (برای تاریخ‌های بدون سال)</Text>
              <Input
                style={{ marginTop: 8 }}
                dir="ltr"
                value={jalaliYear}
                onChange={(e) => setJalaliYear(e.target.value)}
              />
            </div>
          </Flex>

          <div>
            <Text type="secondary">متن پیامک‌ها</Text>
            <TextArea
              style={{ marginTop: 8, fontFamily: "monospace" }}
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
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Flex justify="space-between" align="center" gap="small" wrap="wrap">
            <Title level={5} style={{ margin: 0 }}>
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

          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item style={{ padding: 0, border: "none", marginBottom: 8 }}>
                <Card
                  size="small"
                  style={{
                    width: "100%",
                    opacity: item.isDuplicate ? 0.8 : 1,
                    borderColor: item.isDuplicate ? "rgba(251, 191, 36, 0.3)" : undefined,
                    background: item.isDuplicate ? "rgba(245, 158, 11, 0.05)" : undefined,
                  }}
                >
                  <Flex gap="middle" align="flex-start">
                    <Checkbox
                      disabled={item.isDuplicate}
                      checked={Boolean(selected[item.importHash])}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [item.importHash]: e.target.checked }))
                      }
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Flex justify="space-between" align="center" gap="small" wrap="wrap">
                        <Text strong>
                          {item.type === "income" ? "واریز" : "برداشت"}
                          {item.bankName ? ` · ${item.bankName}` : ""}
                        </Text>
                        <Text
                          strong
                          style={{ color: item.type === "income" ? "#34d399" : "#f87171" }}
                        >
                          {item.type === "income" ? "+" : "-"}
                          {formatToman(item.amount)}
                        </Text>
                      </Flex>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {formatJalaliDate(item.date)}
                        {item.time ? ` · ${item.time}` : ""}
                        {item.balanceAfter !== undefined
                          ? ` · مانده ${formatToman(item.balanceAfter)}`
                          : ""}
                      </Text>
                      {item.isDuplicate ? (
                        <div style={{ marginTop: 4 }}>
                          <Tag icon={<WarningOutlined />} color="warning">
                            قبلاً ایمپورت شده — رد می‌شود
                          </Tag>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <Tag icon={<CheckCircleOutlined />} color="success">
                            آماده ورود · نیاز به نام‌گذاری بعداً
                          </Tag>
                        </div>
                      )}
                    </div>
                  </Flex>
                </Card>
              </List.Item>
            )}
          />

          <Checkbox checked={syncBalance} onChange={(e) => setSyncBalance(e.target.checked)}>
            همگام‌سازی موجودی حساب با آخرین «مانده» پیامک در این دسته
          </Checkbox>

          <Button
            type="primary"
            loading={confirmMutation.isPending}
            disabled={selectedCount === 0}
            onClick={() => confirmMutation.mutate()}
          >
            {`تأیید و ورود ${selectedCount} تراکنش`}
          </Button>
        </Space>
      ) : null}

      {failedBlocks.length > 0 ? (
        <Alert
          type="error"
          showIcon
          message={`${failedBlocks.length} بلوک قابل parse نبود`}
          description={
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {failedBlocks.slice(0, 3).map((b, i) => (
                <pre
                  key={i}
                  style={{
                    margin: 0,
                    fontSize: 12,
                    whiteSpace: "pre-wrap",
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid rgba(148, 163, 184, 0.22)",
                  }}
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
