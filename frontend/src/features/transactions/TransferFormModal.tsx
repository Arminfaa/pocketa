"use client";

import { useEffect } from "react";
import { Button, Form, Grid, Input, Select, Space, Typography } from "antd";
import type { BankAccount } from "@/types/account";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { AppModal } from "@/components/ui/modal";
import {
  formatAmountInputValue,
  normalizeJalaliDateInput,
  parseAmountInput,
} from "@/lib/amount";
import { getTodayJalali } from "@/lib/transaction-helpers";

type FormValues = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  title?: string;
  description?: string;
  date: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    title?: string;
    description?: string | null;
    date: string;
  }) => Promise<void>;
  accounts: BankAccount[];
  defaultFromAccountId?: string | null;
  submitting?: boolean;
};

export function TransferFormModal({
  open,
  onClose,
  onSubmit,
  accounts,
  defaultFromAccountId,
  submitting,
}: Props) {
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      fromAccountId: defaultFromAccountId || accounts[0]?.id || "",
      toAccountId:
        accounts.find((a) => a.id !== (defaultFromAccountId || accounts[0]?.id))?.id ||
        "",
      amount: "",
      title: "انتقال بین حساب‌ها",
      description: "",
      date: getTodayJalali(),
    });
  }, [open, accounts, defaultFromAccountId, form]);

  return (
    <AppModal
      title="انتقال بین حساب‌ها"
      open={open}
      onClose={onClose}
      width={screens.sm ? 520 : "calc(100vw - 24px)"}
      footer={
        <Space className="w-full justify-end">
          <Button onClick={onClose}>انصراف</Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            ثبت انتقال
          </Button>
        </Space>
      }
    >
      <Typography.Text type="secondary" className="mb-3 block text-sm">
        مبلغ از حساب مبدأ کم و به مقصد اضافه می‌شود، بدون اینکه درآمد/هزینه ماه را باد کند.
      </Typography.Text>
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          const amount = parseAmountInput(values.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            form.setFields([{ name: "amount", errors: ["مبلغ معتبر نیست"] }]);
            return;
          }
          await onSubmit({
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amount,
            title: values.title?.trim() || undefined,
            description: values.description?.trim() || null,
            date: normalizeJalaliDateInput(values.date),
          });
        }}
      >
        <Form.Item
          name="fromAccountId"
          label="از حساب"
          rules={[{ required: true, message: "حساب مبدأ را انتخاب کنید" }]}
        >
          <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        </Form.Item>
        <Form.Item
          name="toAccountId"
          label="به حساب"
          rules={[{ required: true, message: "حساب مقصد را انتخاب کنید" }]}
        >
          <Select options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
        </Form.Item>
        <Form.Item
          name="amount"
          label="مبلغ (تومان)"
          rules={[{ required: true, message: "مبلغ را وارد کنید" }]}
          getValueFromEvent={(v) => formatAmountInputValue(String(v ?? ""))}
        >
          <AmountInput />
        </Form.Item>
        <Form.Item name="date" label="تاریخ" rules={[{ required: true }]}>
          <JalaliDateInput />
        </Form.Item>
        <Form.Item name="title" label="عنوان (اختیاری)">
          <Input />
        </Form.Item>
        <Form.Item name="description" label="توضیح (اختیاری)">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
