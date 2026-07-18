"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Col,
  Flex,
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
import { formatToman, toPersianDigits } from "@/lib/format";
import { parseAmountInput } from "@/lib/amount";
import { AmountInput } from "@/components/ui/amount-input";
import { AmountText } from "@/components/ui/amount-text";
import { KpiCard } from "@/components/ui/kpi-card";
import { SectionCard } from "@/components/ui/section-card";
import { AccountsListSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftAvatar, SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import type { BankAccount } from "@/types/account";
import { cn } from "@/lib/cn";

const { Text } = Typography;

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#ec4899"];

const actionBtnClass = "!rounded-xl";

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
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

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
      setFormOpen(false);
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

  const accounts = q.data ?? [];
  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  );

  function startEdit(account: BankAccount) {
    setEditingId(account.id);
    setFormOpen(true);
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
    setFormOpen(false);
  }

  function toggleForm() {
    if (formOpen && !editingId) {
      setFormOpen(false);
      setForm(emptyForm);
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  return (
    <PageShell width="form">
      <PageHeader
        icon={<BankOutlined />}
        title="حساب‌های بانکی"
        description="هر بانک یا کارت را جدا اضافه کنید؛ بعد می‌توانید تراکنش‌ها را جدا یا یکجا ببینید."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={toggleForm}
            aria-label={formOpen && !editingId ? "بستن فرم" : "افزودن حساب"}
          />
        }
      />

      {!q.isLoading && accounts.length > 0 ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12}>
            <KpiCard
              label="مجموع موجودی"
              value={formatToman(totalBalance)}
              icon={<WalletOutlined />}
              tone="brand"
            />
          </Col>
          <Col xs={24} sm={12}>
            <KpiCard
              label="تعداد حساب"
              value={toPersianDigits(String(accounts.length))}
              icon={<BankOutlined />}
              tone="violet"
            />
          </Col>
        </Row>
      ) : null}

      {formOpen || editingId ? (
        <SectionCard
          title={editingId ? "ویرایش حساب" : "افزودن حساب جدید"}
          description="نام، بانک و رنگ را مشخص کنید."
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
        </SectionCard>
      ) : null}

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

      {!q.isLoading && accounts.length === 0 ? (
        <EmptyState
          title="هنوز حسابی ثبت نشده است"
          description="اولین حساب بانکی خود را بسازید تا تراکنش‌ها و ایمپورت به آن وصل شوند."
        />
      ) : accounts.length > 0 ? (
        <SoftList
          header={
            <Text type="secondary" className="text-xs font-medium">
              {toPersianDigits(String(accounts.length))} حساب فعال
            </Text>
          }
        >
          {accounts.map((account) => (
            <SoftListItem key={account.id}>
              <SoftListRow
                leading={
                  <SoftAvatar color={account.color}>
                    <BankOutlined className="text-xl" />
                  </SoftAvatar>
                }
                title={account.name}
                subtitle={account.bankName || "بدون نام بانک"}
                trailing={
                  <AmountText
                    tone={account.balance >= 0 ? "brand" : "expense"}
                    size="sm"
                    caption="موجودی"
                  >
                    {formatToman(account.balance)}
                  </AmountText>
                }
                footer={
                  <Flex gap="small" wrap="wrap">
                    <Button
                      type="default"
                      size="small"
                      className={actionBtnClass}
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
                      size="small"
                      className={actionBtnClass}
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
          ))}
        </SoftList>
      ) : null}
    </PageShell>
  );
}
