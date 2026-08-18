"use client";

import { useEffect } from "react";
import { Button, Col, Form, Grid, Input, Row, Select, Space, Typography } from "antd";
import type { BankAccount } from "@/types/account";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { TimeInput } from "@/components/ui/time-input";
import { AppModal } from "@/components/ui/modal";
import {
  formatAmountInputValue,
  normalizeJalaliDateInput,
  parseAmountInput,
} from "@/lib/amount";
import { formatToman } from "@/lib/format";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { getNowTehranClockTime } from "@/lib/transaction-time";

type FormValues = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  feeAmount?: string;
  title?: string;
  description?: string;
  date: string;
  time?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    feeAmount?: number;
    title?: string;
    description?: string | null;
    date: string;
    time?: string;
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
  const amountWatch = Form.useWatch("amount", form) ?? "";
  const feeWatch = Form.useWatch("feeAmount", form) ?? "";

  const amountNumeric = parseAmountInput(amountWatch);
  const feeNumeric = Math.max(0, Math.round(parseAmountInput(feeWatch) || 0));
  const showFeePreview =
    Number.isFinite(amountNumeric) &&
    amountNumeric > 0 &&
    feeNumeric > 0;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      fromAccountId: defaultFromAccountId || accounts[0]?.id || "",
      toAccountId:
        accounts.find((a) => a.id !== (defaultFromAccountId || accounts[0]?.id))?.id ||
        "",
      amount: "",
      feeAmount: "",
      title: "انتقال بین حساب‌ها",
      description: "",
      date: getTodayJalali(),
      time: getNowTehranClockTime(),
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
        دو تراکنش هم‌زمان ثبت می‌شود: منفی (−) روی حساب مبدأ و مثبت (+) روی حساب مقصد.
        در گزارش درآمد/هزینه ماه شمرده نمی‌شوند. اگر کارمزد وارد کنید، به‌صورت جداگانه
        از حساب مبدأ برداشت می‌شود.
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
          const fee = Math.max(0, Math.round(parseAmountInput(values.feeAmount) || 0));
          await onSubmit({
            fromAccountId: values.fromAccountId,
            toAccountId: values.toAccountId,
            amount,
            ...(fee > 0 ? { feeAmount: fee } : {}),
            title: values.title?.trim() || undefined,
            description: values.description?.trim() || null,
            date: normalizeJalaliDateInput(values.date),
            time: values.time?.trim() || undefined,
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
          label="مبلغ انتقال (تومان)"
          rules={[{ required: true, message: "مبلغ را وارد کنید" }]}
          getValueFromEvent={(v) => formatAmountInputValue(String(v ?? ""))}
        >
          <AmountInput />
        </Form.Item>
        <Form.Item
          name="feeAmount"
          label="کارمزد (اختیاری)"
          getValueFromEvent={(v) => formatAmountInputValue(String(v ?? ""))}
        >
          <AmountInput />
        </Form.Item>
        {showFeePreview ? (
          <Typography.Paragraph type="secondary" className="!mt-0 !mb-3 text-xs">
            جمع برداشت از حساب مبدأ:{" "}
            {formatToman(Math.round(amountNumeric) + feeNumeric)} (انتقال{" "}
            {formatToman(Math.round(amountNumeric))} + کارمزد {formatToman(feeNumeric)})
          </Typography.Paragraph>
        ) : null}
        <Row gutter={[12, 0]}>
          <Col xs={24} sm={12} className="!min-w-0">
            <Form.Item name="date" label="تاریخ" rules={[{ required: true }]}>
              <JalaliDateInput />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12} className="!min-w-0">
            <Form.Item name="time" label="ساعت">
              <TimeInput />
            </Form.Item>
          </Col>
        </Row>
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
