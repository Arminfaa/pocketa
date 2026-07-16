"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Form, Input, Modal, Radio, Select, Typography } from "antd";
import { BulbOutlined } from "@ant-design/icons";
import type { Transaction } from "@/types/transaction";
import type { BankAccount } from "@/types/account";
import { getTodayJalali, accountIdValue, categoryIdValue } from "@/lib/transaction-helpers";
import { suggestCategory } from "@/services/transactions";
import { TagsInput } from "@/components/ui/tags-input";

export type TransactionFormValues = {
  type: "income" | "expense";
  amount: string;
  categoryId: string;
  accountId: string;
  title: string;
  description?: string;
  date: string;
};

type Category = { _id: string; name: string; type: "income" | "expense"; color?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: {
    type: "income" | "expense";
    amount: number;
    categoryId: string;
    accountId: string;
    title: string;
    description?: string | null;
    date: string;
    needsReview?: boolean;
    tags?: string[];
  }) => Promise<void>;
  accounts: BankAccount[];
  categories: Category[];
  initial?: Transaction | null;
  defaultAccountId?: string | null;
  submitting?: boolean;
};

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  accounts,
  categories,
  initial,
  defaultAccountId,
  submitting,
}: Props) {
  const [form] = Form.useForm<TransactionFormValues>();
  const [tags, setTags] = useState<string[]>([]);
  const [suggestLabel, setSuggestLabel] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const type = Form.useWatch("type", form) ?? "expense";
  const title = Form.useWatch("title", form) ?? "";

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        type: initial.type,
        amount: String(initial.amount),
        categoryId: categoryIdValue(initial.categoryId),
        accountId: accountIdValue(initial.accountId) || defaultAccountId || "",
        title: initial.title,
        description: initial.description ?? "",
        date: initial.date,
      });
      setTags(initial.tags ?? []);
    } else {
      form.setFieldsValue({
        type: "expense",
        amount: "",
        categoryId: "",
        accountId: defaultAccountId ?? accounts[0]?.id ?? "",
        title: "",
        description: "",
        date: getTodayJalali(),
      });
      setTags([]);
    }
    setSuggestLabel(null);
  }, [open, initial, defaultAccountId, accounts, form]);

  useEffect(() => {
    const current = form.getFieldValue("categoryId");
    if (current && !filteredCategories.some((c) => c._id === current)) {
      form.setFieldValue("categoryId", "");
    }
  }, [type, filteredCategories, form]);

  async function applySuggestion() {
    const t = title.trim();
    if (t.length < 2) return;
    setSuggesting(true);
    try {
      const result = await suggestCategory({ title: t, type });
      if (result.suggestion) {
        form.setFieldValue("categoryId", result.suggestion._id);
        setSuggestLabel(result.suggestion.name);
      } else {
        setSuggestLabel(null);
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function handleFinish(values: TransactionFormValues) {
    const amount = Number(values.amount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      form.setFields([{ name: "amount", errors: ["مبلغ معتبر نیست"] }]);
      return;
    }
    await onSubmit({
      type: values.type,
      amount,
      categoryId: values.categoryId,
      accountId: values.accountId,
      title: values.title.trim(),
      description: values.description?.trim() || "",
      date: values.date,
      needsReview: false,
      tags,
    });
  }

  return (
    <Modal
      open={open}
      title={initial ? "ویرایش تراکنش" : "افزودن تراکنش"}
      onCancel={onClose}
      destroyOnHidden
      width={520}
      okText={submitting ? "در حال ذخیره..." : initial ? "ذخیره تغییرات" : "ثبت تراکنش"}
      cancelText="انصراف"
      confirmLoading={submitting}
      onOk={() => form.submit()}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item name="type" rules={[{ required: true, message: "نوع را انتخاب کنید" }]}>
          <Radio.Group optionType="button" buttonStyle="solid" style={{ width: "100%", display: "flex" }}>
            <Radio.Button value="expense" style={{ flex: 1, textAlign: "center" }}>
              هزینه
            </Radio.Button>
            <Radio.Button value="income" style={{ flex: 1, textAlign: "center" }}>
              درآمد
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, min: 2, message: "عنوان حداقل ۲ کاراکتر" }]}
        >
          <Input onBlur={() => void applySuggestion()} />
        </Form.Item>

        <Form.Item
          name="amount"
          label="مبلغ (تومان)"
          rules={[{ required: true, message: "مبلغ را وارد کنید" }]}
        >
          <Input dir="ltr" placeholder="500000" />
        </Form.Item>

        <Form.Item
          name="date"
          label="تاریخ شمسی (YYYY/MM/DD)"
          rules={[
            { required: true, message: "تاریخ را وارد کنید" },
            {
              pattern: /^\d{4}\/\d{1,2}\/\d{1,2}$/,
              message: "تاریخ باید به صورت ۱۴۰۵/۰۱/۰۱ باشد (با ارقام انگلیسی)",
            },
          ]}
        >
          <Input dir="ltr" placeholder="1405/04/25" />
        </Form.Item>

        <Form.Item
          name="accountId"
          label="حساب بانکی"
          rules={[{ required: true, message: "حساب را انتخاب کنید" }]}
        >
          <Select
            placeholder="انتخاب حساب"
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.name}${a.bankName ? ` · ${a.bankName}` : ""}`,
            }))}
          />
        </Form.Item>

        <Form.Item label="دسته‌بندی" required>
          <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {suggestLabel ? `پیشنهاد اعمال‌شده: ${suggestLabel}` : null}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              icon={<BulbOutlined />}
              disabled={suggesting || title.trim().length < 2}
              loading={suggesting}
              onClick={() => void applySuggestion()}
            >
              پیشنهاد از عنوان
            </Button>
          </Flex>
          <Form.Item
            name="categoryId"
            noStyle
            rules={[{ required: true, message: "دسته‌بندی را انتخاب کنید" }]}
          >
            <Select
              placeholder="انتخاب دسته"
              options={filteredCategories.map((c) => ({
                value: c._id,
                label: c.name,
              }))}
            />
          </Form.Item>
        </Form.Item>

        <Form.Item label="تگ‌ها (اختیاری)">
          <TagsInput value={tags} onChange={setTags} />
        </Form.Item>

        <Form.Item name="description" label="توضیحات (اختیاری)">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
