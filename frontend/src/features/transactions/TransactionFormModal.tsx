"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Col,
  Flex,
  Form,
  Grid,
  Input,
  Radio,
  Row,
  Select,
  Typography,
} from "antd";
import { BulbOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { Transaction } from "@/types/transaction";
import type { BankAccount } from "@/types/account";
import { getTodayJalali, accountIdValue, categoryIdValue } from "@/lib/transaction-helpers";
import { suggestCategory } from "@/services/transactions";
import { fetchRecurring } from "@/services/recurring";
import { TagsInput } from "@/components/ui/tags-input";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { AppModal } from "@/components/ui/modal";
import {
  FinanceTypeToggle,
  financeTypeTextClass,
} from "@/components/ui/finance-type-toggle";
import {
  formatAmountInputValue,
  normalizeJalaliDateInput,
  parseAmountInput,
} from "@/lib/amount";
import { formatToman } from "@/lib/format";
import { cn } from "@/lib/cn";

export type TransactionFormValues = {
  type: "income" | "expense";
  amount: string;
  categoryId: string;
  accountId: string;
  title: string;
  description?: string;
  date: string;
  registerAsDebt?: boolean;
  debtDueDate?: string;
  linkToRecurring?: boolean;
  settleRecurringId?: string;
  settleMode?: "full" | "partial";
  remainderDueDate?: string;
};

type Category = { _id: string; name: string; type: "income" | "expense"; color?: string };

type SubmitValues = {
  type: "income" | "expense";
  amount: number;
  categoryId: string;
  accountId: string;
  title: string;
  description?: string | null;
  date: string;
  needsReview?: boolean;
  tags?: string[];
  registerAsDebt?: boolean;
  debtDueDate?: string | null;
  settleRecurringId?: string | null;
  settleMode?: "full" | "partial" | null;
  remainderDueDate?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: SubmitValues) => Promise<void>;
  accounts: BankAccount[];
  categories: Category[];
  initial?: Transaction | null;
  defaultAccountId?: string | null;
  submitting?: boolean;
};

function obligationLabel(type: "income" | "expense") {
  return type === "income"
    ? "ثبت به‌عنوان بدهی (تراکنش مثبت + سررسید بازپرداخت)"
    : "ثبت به‌عنوان طلب (تراکنش منفی + سررسید دریافت)";
}

function obligationHint(type: "income" | "expense") {
  return type === "income"
    ? "مبلغ به‌صورت درآمد می‌ماند و همان مبلغ در جریان دوره‌ای به‌عنوان بدهی یک‌باره با تاریخ بازپرداخت ذخیره می‌شود."
    : "مبلغ به‌صورت هزینه می‌ماند و همان مبلغ در جریان دوره‌ای به‌عنوان طلب یک‌باره با تاریخ دریافت ذخیره می‌شود.";
}

function dueDateLabel(type: "income" | "expense") {
  return type === "income" ? "تاریخ پس دادن بدهی" : "تاریخ دریافت طلب";
}

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
  const screens = Grid.useBreakpoint();
  const modalWidth = screens.sm ? 640 : "calc(100vw - 24px)";
  const isCreate = !initial;

  const [form] = Form.useForm<TransactionFormValues>();
  const [tags, setTags] = useState<string[]>([]);
  const [suggestLabel, setSuggestLabel] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const type = Form.useWatch("type", form) ?? "expense";
  const title = Form.useWatch("title", form) ?? "";
  const registerAsDebt = Form.useWatch("registerAsDebt", form) ?? false;
  const linkToRecurring = Form.useWatch("linkToRecurring", form) ?? false;
  const settleRecurringId = Form.useWatch("settleRecurringId", form);
  const settleMode = Form.useWatch("settleMode", form) ?? "full";
  const amountWatch = Form.useWatch("amount", form) ?? "";

  const recurringQ = useQuery({
    queryKey: ["recurring"],
    queryFn: fetchRecurring,
    enabled: open && isCreate && linkToRecurring,
  });

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const recurringOptions = useMemo(() => {
    const items = (recurringQ.data?.items ?? []).filter(
      (i) => i.active && i.type === type
    );
    return items.map((i) => ({
      value: i.id,
      label: `${i.title} · ${formatToman(i.amount)} · ${i.nextPaymentDate}`,
      amount: i.amount,
    }));
  }, [recurringQ.data, type]);

  const selectedRecurring = recurringOptions.find((o) => o.value === settleRecurringId);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      form.setFieldsValue({
        type: initial.type,
        amount: formatAmountInputValue(initial.amount),
        categoryId: categoryIdValue(initial.categoryId),
        accountId: accountIdValue(initial.accountId) || defaultAccountId || "",
        title: initial.title,
        description: initial.description ?? "",
        date: initial.date,
        registerAsDebt: false,
        debtDueDate: undefined,
        linkToRecurring: false,
        settleRecurringId: undefined,
        settleMode: "full",
        remainderDueDate: "",
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
        registerAsDebt: false,
        debtDueDate: "",
        linkToRecurring: false,
        settleRecurringId: undefined,
        settleMode: "full",
        remainderDueDate: "",
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

  useEffect(() => {
    if (!isCreate) return;
    if (registerAsDebt) {
      form.setFieldValue("linkToRecurring", false);
      form.setFieldValue("settleRecurringId", undefined);
    }
  }, [registerAsDebt, isCreate, form]);

  useEffect(() => {
    if (!isCreate) return;
    if (linkToRecurring) {
      form.setFieldValue("registerAsDebt", false);
      form.setFieldValue("debtDueDate", "");
      form.setFieldValue("settleRecurringId", undefined);
    }
  }, [linkToRecurring, isCreate, form]);

  useEffect(() => {
    // Clear selected سررسید when type changes (list is type-filtered)
    if (linkToRecurring) {
      form.setFieldValue("settleRecurringId", undefined);
    }
  }, [type, linkToRecurring, form]);

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
    const amount = parseAmountInput(values.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      form.setFields([{ name: "amount", errors: ["مبلغ معتبر نیست"] }]);
      return;
    }
    const asDebt = Boolean(isCreate && values.registerAsDebt);
    const asSettle = Boolean(isCreate && values.linkToRecurring && values.settleRecurringId);

    if (asDebt && !values.debtDueDate?.trim()) {
      form.setFields([{ name: "debtDueDate", errors: ["تاریخ سررسید را وارد کنید"] }]);
      return;
    }
    if (values.linkToRecurring && !values.settleRecurringId) {
      form.setFields([{ name: "settleRecurringId", errors: ["سررسید را انتخاب کنید"] }]);
      return;
    }
    if (asSettle && values.settleMode === "full" && selectedRecurring) {
      if (Math.round(amount) !== Math.round(selectedRecurring.amount)) {
        form.setFields([
          {
            name: "amount",
            errors: [
              `تسویه کامل نیست؛ مبلغ باید ${formatToman(selectedRecurring.amount)} باشد`,
            ],
          },
        ]);
        return;
      }
    }
    if (asSettle && values.settleMode === "partial" && selectedRecurring) {
      if (amount >= selectedRecurring.amount) {
        form.setFields([
          {
            name: "amount",
            errors: ["برای مبلغ مساوی یا بیشتر از سررسید، تسویه کامل را انتخاب کنید"],
          },
        ]);
        return;
      }
      if (!values.remainderDueDate?.trim()) {
        form.setFields([
          { name: "remainderDueDate", errors: ["تاریخ تسویه مانده را وارد کنید"] },
        ]);
        return;
      }
    }

    await onSubmit({
      type: values.type,
      amount,
      categoryId: values.categoryId,
      accountId: values.accountId,
      title: values.title.trim(),
      description: values.description?.trim() || "",
      date: normalizeJalaliDateInput(values.date),
      needsReview: false,
      tags,
      registerAsDebt: asDebt,
      debtDueDate: asDebt ? normalizeJalaliDateInput(values.debtDueDate!) : undefined,
      settleRecurringId: asSettle ? values.settleRecurringId : undefined,
      settleMode: asSettle ? values.settleMode ?? "full" : undefined,
      remainderDueDate:
        asSettle && values.settleMode === "partial"
          ? normalizeJalaliDateInput(values.remainderDueDate!)
          : undefined,
    });
  }

  const submitLabel = (() => {
    if (submitting) return "در حال ذخیره...";
    if (initial) return "ذخیره تغییرات";
    if (registerAsDebt) {
      return type === "income" ? "ثبت درآمد و بدهی" : "ثبت هزینه و طلب";
    }
    if (linkToRecurring) return "ثبت و تسویه سررسید";
    return "ثبت تراکنش";
  })();

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={initial ? "ویرایش تراکنش" : "افزودن تراکنش"}
      subtitle="مبلغ به تومان و تاریخ به صورت شمسی وارد شود"
      width={modalWidth}
      footer={
        <Flex justify="end" gap="small" wrap="wrap" className="w-full">
          <Button onClick={onClose} className="min-w-[96px]">
            انصراف
          </Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => form.submit()}
            className="min-w-[120px]"
          >
            {submitLabel}
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} requiredMark={false}>
        <Form.Item
          name="type"
          className="!mb-4 w-full"
          rules={[{ required: true, message: "نوع را انتخاب کنید" }]}
        >
          <FinanceTypeToggle className="w-full" />
        </Form.Item>

        {isCreate ? (
          <>
            <Form.Item name="registerAsDebt" valuePropName="checked" className="!mb-2">
              <Checkbox disabled={linkToRecurring}>{obligationLabel(type)}</Checkbox>
            </Form.Item>

            {registerAsDebt ? (
              <Typography.Paragraph type="secondary" className="!mt-0 !mb-3 text-xs">
                {obligationHint(type)}
              </Typography.Paragraph>
            ) : null}

            <Form.Item name="linkToRecurring" valuePropName="checked" className="!mb-2">
              <Checkbox disabled={registerAsDebt}>
                اتصال به سررسید موجود (تسویه از جریان دوره‌ای)
              </Checkbox>
            </Form.Item>
          </>
        ) : null}

        <Form.Item
          name="title"
          label="عنوان"
          rules={[{ required: true, min: 2, message: "عنوان حداقل ۲ کاراکتر" }]}
        >
          <Input onBlur={() => void applySuggestion()} />
        </Form.Item>

        <Row gutter={[12, 0]}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="amount"
              label="مبلغ (تومان)"
              rules={[{ required: true, message: "مبلغ را وارد کنید" }]}
            >
              <AmountInput
                placeholder="۵۰۰٬۰۰۰"
                className={cn(financeTypeTextClass(type))}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="date"
              label="تاریخ شمسی (YYYY/MM/DD)"
              rules={[
                { required: true, message: "تاریخ را وارد کنید" },
                {
                  pattern: /^\d{4}\/\d{1,2}\/\d{1,2}$/,
                  message: "تاریخ باید به صورت 1405/01/01 باشد",
                },
              ]}
            >
              <JalaliDateInput placeholder="1405/04/25" />
            </Form.Item>
          </Col>
        </Row>

        {isCreate && registerAsDebt ? (
          <Form.Item
            name="debtDueDate"
            label={dueDateLabel(type)}
            rules={[
              { required: true, message: "تاریخ سررسید را وارد کنید" },
              {
                pattern: /^\d{4}\/\d{1,2}\/\d{1,2}$/,
                message: "تاریخ باید به صورت 1405/01/01 باشد",
              },
            ]}
          >
            <JalaliDateInput placeholder="1405/05/01" />
          </Form.Item>
        ) : null}

        {isCreate && linkToRecurring ? (
          <>
            <Form.Item
              name="settleRecurringId"
              label="انتخاب سررسید"
              rules={[{ required: true, message: "سررسید را انتخاب کنید" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={
                  recurringQ.isLoading ? "در حال بارگذاری..." : "از لیست سررسیدها انتخاب کنید"
                }
                options={recurringOptions}
                notFoundContent={
                  recurringQ.isLoading ? "..." : "سررسید فعالی با این نوع تراکنش نیست"
                }
              />
            </Form.Item>

            <Form.Item name="settleMode" label="نوع تسویه" initialValue="full">
              <Radio.Group>
                <Radio value="full">تسویه کامل</Radio>
                <Radio value="partial">پرداخت جزئی</Radio>
              </Radio.Group>
            </Form.Item>

            {selectedRecurring && settleMode === "full" ? (
              <Typography.Paragraph type="secondary" className="!mt-0 !mb-3 text-xs">
                مبلغ سررسید: {formatToman(selectedRecurring.amount)} — برای تسویه کامل باید مبلغ
                تراکنش دقیقاً همین باشد.
                {amountWatch &&
                Math.round(parseAmountInput(amountWatch) || 0) !==
                  Math.round(selectedRecurring.amount)
                  ? " مبلغ فعلی یکی نیست."
                  : ""}
              </Typography.Paragraph>
            ) : null}

            {settleMode === "partial" ? (
              <Form.Item
                name="remainderDueDate"
                label="تاریخ تسویه مانده"
                rules={[
                  { required: true, message: "تاریخ تسویه مانده را وارد کنید" },
                  {
                    pattern: /^\d{4}\/\d{1,2}\/\d{1,2}$/,
                    message: "تاریخ باید به صورت 1405/01/01 باشد",
                  },
                ]}
              >
                <JalaliDateInput placeholder="1405/05/01" />
              </Form.Item>
            ) : null}
          </>
        ) : null}

        <Row gutter={[12, 0]}>
          <Col xs={24} sm={12}>
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
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="دسته‌بندی" required>
              <Flex
                justify="space-between"
                align={screens.sm ? "center" : "flex-start"}
                wrap="wrap"
                gap="small"
                className="mb-2"
              >
                <Typography.Text type="secondary" className="text-xs min-w-0">
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
          </Col>
        </Row>

        <Form.Item label="تگ‌ها (اختیاری)">
          <TagsInput value={tags} onChange={setTags} />
        </Form.Item>

        <Form.Item name="description" label="توضیحات (اختیاری)" className="!mb-0">
          <Input.TextArea rows={3} />
        </Form.Item>
      </Form>
    </AppModal>
  );
}
