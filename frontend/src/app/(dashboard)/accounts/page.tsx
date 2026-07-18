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
  Modal,
  Popconfirm,
  Row,
  Space,
  Typography,
} from "antd";
import {
  BankOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  adjustAccountBalance,
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
} from "@/services/accounts";
import { formatToman } from "@/lib/format";
import { parseAmountInput } from "@/lib/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { AccountsListSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import type { BankAccount } from "@/types/account";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

type FormState = {
  name: string;
  bankName: string;
  color: string;
  initialBalance: string;
};

const emptyForm: FormState = {
  name: "",
  bankName: "",
  color: COLORS[0]!,
  initialBalance: "0",
};

export default function AccountsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  const [balanceTarget, setBalanceTarget] = useState<{
    account: BankAccount;
    amount: string;
  } | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const opening = parseAmountInput(form.initialBalance);
      const payload = {
        name: form.name.trim(),
        bankName: form.bankName.trim() || undefined,
        color: form.color,
        ...(editingId
          ? {}
          : { initialBalance: Number.isFinite(opening) && opening > 0 ? opening : 0 }),
      };
      if (editingId) return updateAccount(editingId, payload);
      return createAccount(payload);
    },
    onSuccess: () => {
      message.success(editingId ? "حساب به‌روزرسانی شد" : "حساب جدید ساخته شد");
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره حساب";
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAccount(id),
    onSuccess: () => {
      message.success("حساب غیرفعال شد");
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف حساب";
      message.error(msg);
    },
  });

  const setBalanceMutation = useMutation({
    mutationFn: async () => {
      if (!balanceTarget) throw new Error("حساب انتخاب نشده");
      const amount = parseAmountInput(balanceTarget.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("مبلغ موجودی معتبر نیست");
      }
      return adjustAccountBalance(balanceTarget.account.id, amount);
    },
    onSuccess: (item) => {
      if (item.adjustment) {
        const kind = item.adjustment.type === "expense" ? "هزینه" : "درآمد";
        message.success(
          `موجودی ${formatToman(item.balance)} شد · تراکنش ${kind} تعدیل ${formatToman(item.adjustment.amount)} ثبت شد`
        );
      } else {
        message.success("موجودی از قبل با عدد واردشده یکی بود");
      }
      setBalanceTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { message?: string }).message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "تنظیم موجودی ناموفق بود";
      message.error(msg);
    },
  });

  const totalBalance = useMemo(
    () => (q.data ?? []).reduce((sum, a) => sum + a.balance, 0),
    [q.data]
  );

  function startEdit(account: BankAccount) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      bankName: account.bankName,
      color: account.color,
      initialBalance: "0",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <Space orientation="vertical" size="large" className="w-full max-w-3xl">
      <Flex justify="space-between" align="flex-end" gap="middle" wrap="wrap">
        <div>
          <Title level={4} className="!m-0">
            حساب‌های بانکی
          </Title>
          <Text type="secondary">
            هر بانک یا کارت را جدا اضافه کنید؛ بعد می‌توانید تراکنش‌ها را جدا یا یکجا ببینید.
          </Text>
        </div>
        <div className="text-left">
          <Text type="secondary" className="text-xs">
            مجموع موجودی
          </Text>
          <div>
            <Text strong className="text-brand-500 text-base">
              {formatToman(totalBalance)}
            </Text>
          </div>
        </div>
      </Flex>

      <Card
        title={
          <Space>
            <PlusOutlined />
            {editingId ? "ویرایش حساب" : "افزودن حساب جدید"}
          </Space>
        }
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Text type="secondary">نام حساب</Text>
              <Input
                className="mt-2"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="مثلاً کارت پاسارگاد"
              />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary">نام بانک (اختیاری)</Text>
              <Input
                className="mt-2"
                value={form.bankName}
                onChange={(e) => setForm((s) => ({ ...s, bankName: e.target.value }))}
                placeholder="پاسارگاد / ملی / ..."
              />
            </Col>
            {!editingId ? (
              <Col xs={24} md={12}>
                <Text type="secondary">موجودی اولیه (تومان)</Text>
                <div className="mt-2">
                  <AmountInput
                    value={form.initialBalance}
                    onChange={(v) => setForm((s) => ({ ...s, initialBalance: v }))}
                    placeholder="۱۰٬۰۰۰٬۰۰۰"
                  />
                </div>
                <Text type="secondary" className="mt-1 block text-xs">
                  به‌صورت تراکنش درآمد «موجودی اولیه» ثبت می‌شود تا موجودی = درآمد − هزینه بماند.
                </Text>
              </Col>
            ) : null}
            <Col xs={24} md={12}>
              <Text type="secondary">رنگ</Text>
              <Flex gap={8} wrap="wrap" className="mt-2">
                {COLORS.map((c) => (
                  <Button
                    key={c}
                    type="text"
                    aria-label={c}
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
                    className={cn(
                      "w-8 h-8 min-w-8 p-0 rounded-xl",
                      form.color === c
                        ? "border-2 border-white ring-2 ring-brand-500"
                        : "border border-slate-400/20"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </Flex>
            </Col>
          </Row>

          <Space>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => saveMutation.mutate()}
            >
              {editingId ? "ذخیره تغییرات" : "افزودن حساب"}
            </Button>
            {editingId ? <Button onClick={cancelEdit}>انصراف</Button> : null}
          </Space>
        </Space>
      </Card>

      {q.isLoading ? <AccountsListSkeleton /> : null}

      {q.error ? (
        <QueryError message="خطا در دریافت حساب‌ها." onRetry={() => void q.refetch()} />
      ) : null}

      <Modal
        title={
          balanceTarget
            ? `تنظیم موجودی «${balanceTarget.account.name}»`
            : "تنظیم موجودی"
        }
        open={Boolean(balanceTarget)}
        onCancel={() => setBalanceTarget(null)}
        onOk={() => setBalanceMutation.mutate()}
        okText="اعمال موجودی"
        cancelText="انصراف"
        confirmLoading={setBalanceMutation.isPending}
        destroyOnHidden
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Text type="secondary">
            موجودی دفتر همیشه برابر است با جمع درآمد منهای جمع هزینه. اگر عدد واقعی کارت فرق
            دارد، مابه‌التفاوت به‌صورت تراکنش «تعدیل موجودی» ثبت می‌شود تا هم موجودی و هم
            درآمد/هزینه با هم یکی بمانند.
          </Text>
          {balanceTarget ? (
            <Text type="secondary" className="text-xs">
              موجودی فعلی دفتر: {formatToman(balanceTarget.account.balance)}
            </Text>
          ) : null}
          <div>
            <Text type="secondary">موجودی واقعی (تومان)</Text>
            <div className="mt-2">
              <AmountInput
                value={balanceTarget?.amount ?? ""}
                onChange={(v) =>
                  setBalanceTarget((s) => (s ? { ...s, amount: v } : s))
                }
                placeholder="۲٬۹۲۱٬۳۱۲"
              />
            </div>
          </div>
        </Space>
      </Modal>

      {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="هنوز حسابی ثبت نشده است"
          description="اولین حساب بانکی خود را بسازید تا تراکنش‌ها و ایمپورت به آن وصل شوند."
        />
      ) : (
        <Space orientation="vertical" size="middle" className="w-full">
          {(q.data ?? []).map((account) => (
            <Card key={account.id} className="w-full" classNames={{ body: "p-4" }}>
              <Flex
                justify="space-between"
                align={isMobile ? "stretch" : "center"}
                gap="middle"
                wrap="wrap"
                vertical={isMobile}
              >
                <Flex align="center" gap="middle" className="min-w-0 flex-1 mb-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{ background: account.color }}
                  >
                    <BankOutlined className="text-xl" />
                  </div>
                  <div className="min-w-0">
                    <Text strong ellipsis>
                      {account.name}
                    </Text>
                    <div>
                      <Text type="secondary" ellipsis className="text-sm">
                        {account.bankName || "بدون نام بانک"}
                      </Text>
                    </div>
                  </div>
                </Flex>

                <Flex
                  align="center"
                  gap="small"
                  wrap="wrap"
                  className={cn("shrink-0", isMobile && "w-full")}
                >
                  <div className={cn("text-left", isMobile ? "flex-1 me-0" : "me-2")}>
                    <Text type="secondary" className="text-xs">
                      موجودی
                    </Text>
                    <div>
                      <Text strong>{formatToman(account.balance)}</Text>
                    </div>
                  </div>
                  <Button
                    type="default"
                    icon={<WalletOutlined />}
                    onClick={() =>
                      setBalanceTarget({
                        account,
                        amount: String(Math.max(0, Math.round(account.balance))),
                      })
                    }
                    aria-label="تنظیم موجودی"
                    title="تنظیم موجودی با تراکنش تعدیل"
                  />
                  <Button
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() => startEdit(account)}
                    aria-label="ویرایش"
                  />
                  <Popconfirm
                    title="غیرفعال کردن حساب"
                    description={`حساب «${account.name}» غیرفعال شود؟`}
                    okText="غیرفعال"
                    cancelText="انصراف"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutate(account.id)}
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
              </Flex>
            </Card>
          ))}
        </Space>
      )}
    </Space>
  );
}
