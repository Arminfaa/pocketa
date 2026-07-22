"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Form, Input, Select, Typography } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ThunderboltOutlined } from "@ant-design/icons";
import { AppModal } from "@/components/ui/modal";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import {
  FinanceTypeToggle,
  financeTypeTextClass,
} from "@/components/ui/finance-type-toggle";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/transactions";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { parseAmountInput } from "@/lib/amount";
import { useAuthStore } from "@/stores/auth.store";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { useQuickCaptureStore } from "@/stores/quick-capture.store";
import {
  getAccountsSnapshot,
  getCategoriesSnapshot,
} from "@/lib/offline/snapshots";
import { captureTransaction } from "@/lib/offline/capture";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAppMessage } from "@/lib/antd-app";
import { cn } from "@/lib/cn";

const { Text } = Typography;

type FormValues = {
  type: "income" | "expense";
  amount: string;
  categoryId: string;
  accountId: string;
  title: string;
  date: string;
};

export function QuickCaptureModalHost() {
  const open = useQuickCaptureStore((s) => s.open);
  const closeQuickCapture = useQuickCaptureStore((s) => s.closeQuickCapture);
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const online = useOnlineStatus();
  const { message } = useAppMessage();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [snapAccounts, setSnapAccounts] = useState<
    Awaited<ReturnType<typeof getAccountsSnapshot>>
  >([]);
  const [snapCategories, setSnapCategories] = useState<
    Awaited<ReturnType<typeof getCategoriesSnapshot>>
  >([]);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
    enabled: open && online,
  });
  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
    enabled: open && online,
  });

  useEffect(() => {
    if (!open || !userId) return;
    void (async () => {
      const [a, c] = await Promise.all([
        getAccountsSnapshot(userId),
        getCategoriesSnapshot(userId),
      ]);
      setSnapAccounts(a);
      setSnapCategories(c);
    })();
  }, [open, userId]);

  const accounts = useMemo(() => {
    const live = accountsQ.data;
    if (live && live.length > 0) return live.filter((a) => a.isActive);
    return snapAccounts.filter((a) => a.isActive);
  }, [accountsQ.data, snapAccounts]);

  const categories = useMemo(() => {
    const live = categoriesQ.data;
    if (live && live.length > 0) return live;
    return snapCategories;
  }, [categoriesQ.data, snapCategories]);

  const type = Form.useWatch("type", form) ?? "expense";
  const filteredCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!open) return;
    const defaultAccount =
      selectedAccountId && accounts.some((a) => a.id === selectedAccountId)
        ? selectedAccountId
        : accounts[0]?.id ?? "";
    form.setFieldsValue({
      type: "expense",
      amount: "",
      title: "",
      date: getTodayJalali(),
      accountId: defaultAccount,
      categoryId: "",
    });
  }, [open, accounts, selectedAccountId, form]);

  useEffect(() => {
    if (!open) return;
    const current = form.getFieldValue("categoryId");
    if (current && filteredCategories.some((c) => c._id === current)) return;
    form.setFieldValue("categoryId", filteredCategories[0]?._id ?? "");
  }, [open, type, filteredCategories, form]);

  async function handleSubmit() {
    if (!userId) {
      message.error("برای ثبت باید وارد شوید");
      return;
    }
    if (accounts.length === 0 || filteredCategories.length === 0) {
      message.error(
        online
          ? "ابتدا حساب و دسته‌بندی بسازید"
          : "برای ثبت آفلاین، یک‌بار آنلاین حساب‌ها و دسته‌ها را بارگذاری کنید"
      );
      return;
    }

    try {
      const values = await form.validateFields();
      const amount = parseAmountInput(values.amount);
      if (!amount || amount <= 0) {
        message.error("مبلغ معتبر وارد کنید");
        return;
      }
      const title = values.title.trim();
      if (title.length < 2) {
        message.error("عنوان حداقل ۲ کاراکتر باشد");
        return;
      }

      setSubmitting(true);
      const account = accounts.find((a) => a.id === values.accountId);
      const category = categories.find((c) => c._id === values.categoryId);

      const result = await captureTransaction({
        userId,
        preferQueue: true,
        accountName: account?.name,
        categoryName: category?.name,
        payload: {
          type: values.type,
          amount,
          categoryId: values.categoryId,
          accountId: values.accountId,
          title,
          date: values.date,
          description: null,
        },
      });

      if (result.mode === "synced") {
        message.success("تراکنش ثبت شد");
        void queryClient.invalidateQueries({ queryKey: ["transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } else {
        message.success(
          online
            ? "در صف ارسال قرار گرفت"
            : "آفلاین ذخیره شد — بعد از اتصال ارسال می‌شود"
        );
        void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      }
      closeQuickCapture();
    } catch {
      // validation errors
    } finally {
      setSubmitting(false);
    }
  }

  const noLocalData = accounts.length === 0 || categories.length === 0;

  return (
    <AppModal
      open={open}
      onClose={closeQuickCapture}
      title={
        <span className="inline-flex items-center gap-2">
          <ThunderboltOutlined className="text-cyan-600 dark:text-brand-300" />
          ثبت سریع
        </span>
      }
      subtitle={
        online
          ? "ثبت فوری — در صورت قطعی نت در صف می‌ماند"
          : "بدون اینترنت — محلی ذخیره و بعداً همگام می‌شود"
      }
      width={440}
      footer={
        <Flex gap="small" justify="end" className="w-full">
          <Button onClick={closeQuickCapture} className="!rounded-xl">
            انصراف
          </Button>
          <Button
            type="primary"
            loading={submitting}
            disabled={noLocalData}
            onClick={() => void handleSubmit()}
            className="!rounded-xl"
          >
            ثبت
          </Button>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} className="pt-1">
        <Form.Item name="type" className="!mb-3">
          <FinanceTypeToggle />
        </Form.Item>

        <Form.Item
          name="amount"
          label={<span className={financeTypeTextClass(type)}>مبلغ</span>}
          rules={[{ required: true, message: "مبلغ را وارد کنید" }]}
          className="!mb-3"
        >
          <AmountInput placeholder="مثلاً ۵۰٬۰۰۰" autoFocus />
        </Form.Item>

        <Form.Item
          name="title"
          label="عنوان"
          rules={[
            { required: true, message: "عنوان را وارد کنید" },
            { min: 2, message: "حداقل ۲ کاراکتر" },
          ]}
          className="!mb-3"
        >
          <Input placeholder="مثلاً خرید نان" maxLength={120} className="!rounded-xl" />
        </Form.Item>

        <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
          <Form.Item
            name="accountId"
            label="حساب"
            rules={[{ required: true, message: "حساب را انتخاب کنید" }]}
            className="!mb-3"
          >
            <Select
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="حساب"
              className="w-full"
            />
          </Form.Item>
          <Form.Item
            name="categoryId"
            label="دسته"
            rules={[{ required: true, message: "دسته را انتخاب کنید" }]}
            className="!mb-3"
          >
            <Select
              options={filteredCategories.map((c) => ({
                value: c._id,
                label: c.name,
              }))}
              placeholder="دسته"
              className="w-full"
            />
          </Form.Item>
        </div>

        <Form.Item
          name="date"
          label="تاریخ"
          rules={[{ required: true, message: "تاریخ را وارد کنید" }]}
          className="!mb-1"
        >
          <JalaliDateInput />
        </Form.Item>

        {noLocalData ? (
          <Text
            type="danger"
            className={cn("!mt-2 block !text-xs")}
          >
            {online
              ? "حساب یا دسته‌بندی موجود نیست."
              : "هنوز داده‌ای برای حالت آفلاین ذخیره نشده. یک‌بار آنلاین وارد شوید تا حساب‌ها و دسته‌ها کش شوند."}
          </Text>
        ) : null}
      </Form>
    </AppModal>
  );
}
