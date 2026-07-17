"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Checkbox, Flex, Radio, Select, Space, Typography } from "antd";
import type { BankAccount } from "@/types/account";
import type {
  GenerateRecurringPayload,
  RecurringItem,
  RecurringPaymentMode,
  RemainderHandling,
} from "@/services/recurring";
import { AppModal } from "@/components/ui/modal";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { formatAmountInputValue, normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";

const { Text } = Typography;

type Props = {
  open: boolean;
  item: RecurringItem | null;
  accounts: BankAccount[];
  defaultAccountId: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: GenerateRecurringPayload) => void;
};

export function RecurringPayModal({
  open,
  item,
  accounts,
  defaultAccountId,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  const { message } = App.useApp();
  const [accountId, setAccountId] = useState("");
  const [mode, setMode] = useState<RecurringPaymentMode>("full");
  const [partialEnabled, setPartialEnabled] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [remainderHandling, setRemainderHandling] =
    useState<RemainderHandling>("next_month");
  const [remainderDueDate, setRemainderDueDate] = useState("");
  const [postponeDueDate, setPostponeDueDate] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setAccountId(defaultAccountId);
    setMode("full");
    setPartialEnabled(false);
    setPaidAmount(formatAmountInputValue(item.amount));
    setRemainderHandling(item.kind === "recurring" ? "next_month" : "new_debt");
    setRemainderDueDate(item.nextPaymentDate);
    setPostponeDueDate(item.nextPaymentDate);
  }, [open, item, defaultAccountId]);

  const dueAmount = item?.amount ?? 0;
  const baseAmount = item?.baseAmount ?? dueAmount;
  const paidNumeric = parseAmountInput(paidAmount);
  const remainder =
    Number.isFinite(paidNumeric) && paidNumeric > 0 && paidNumeric < dueAmount
      ? dueAmount - paidNumeric
      : 0;

  const nextMonthPreview = useMemo(() => {
    if (!item || mode !== "partial" || remainderHandling !== "next_month") return null;
    if (remainder <= 0) return null;
    return baseAmount + remainder;
  }, [item, mode, remainderHandling, remainder, baseAmount]);

  const postponePreview = useMemo(() => {
    if (!item || mode !== "postpone") return null;
    return dueAmount + baseAmount;
  }, [item, mode, dueAmount, baseAmount]);

  function handleSubmit() {
    if (!item) return;

    if (mode === "postpone") {
      const date = normalizeJalaliDateInput(postponeDueDate);
      if (!date) {
        message.error("تاریخ تعویق را وارد کنید");
        return;
      }
      onSubmit({ mode: "postpone", postponeDueDate: date });
      return;
    }

    const acc = accountId || defaultAccountId;
    if (!acc) {
      message.error("حساب بانکی را انتخاب کنید");
      return;
    }

    if (mode === "full" || !partialEnabled) {
      onSubmit({ mode: "full", accountId: acc });
      return;
    }

    const paid = parseAmountInput(paidAmount);
    if (!Number.isFinite(paid) || paid <= 0) {
      message.error("مبلغ پرداختی معتبر نیست");
      return;
    }
    if (paid >= dueAmount) {
      message.error("مبلغ پرداختی باید کمتر از مبلغ قسط باشد");
      return;
    }

    const payload: GenerateRecurringPayload = {
      mode: "partial",
      accountId: acc,
      paidAmount: paid,
      remainderHandling,
    };

    if (remainderHandling === "new_debt") {
      const date = normalizeJalaliDateInput(remainderDueDate);
      if (!date) {
        message.error("تاریخ سررسید مانده را وارد کنید");
        return;
      }
      payload.remainderDueDate = date;
    }

    onSubmit(payload);
  }

  if (!item) return null;

  const showPartialOptions = partialEnabled && mode !== "postpone";
  const effectiveMode: RecurringPaymentMode =
    mode === "postpone" ? "postpone" : partialEnabled ? "partial" : "full";

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="ثبت تراکنش"
      subtitle={item.title}
      footer={
        <Flex gap="small" justify="flex-end" wrap="wrap">
          <Button onClick={onClose}>انصراف</Button>
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            {effectiveMode === "postpone"
              ? item.kind === "recurring"
                ? "تعویق قسط"
                : "تعویق سررسید"
              : "ثبت تراکنش"}
          </Button>
        </Flex>
      }
    >
      <Space orientation="vertical" size="middle" className="w-full">
        <div className="rounded-xl border border-slate-400/15 bg-slate-500/5 p-3">
          <Text type="secondary" className="text-xs">
            مبلغ سررسید
          </Text>
          <div>
            <Text strong className="text-base">
              {formatToman(dueAmount)}
            </Text>
            {dueAmount !== baseAmount ? (
              <Text type="secondary" className="text-xs ms-2">
                (پایه {formatToman(baseAmount)})
              </Text>
            ) : null}
          </div>
          <Text type="secondary" className="text-xs">
            موعد: {formatJalaliDate(item.nextPaymentDate)}
          </Text>
        </div>

        {item.kind === "recurring" ? (
          <Radio.Group
            className="w-full"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as RecurringPaymentMode;
              setMode(next);
              if (next === "postpone") setPartialEnabled(false);
            }}
            options={[
              { value: "full", label: "تسویه / پرداخت" },
              { value: "postpone", label: "تعویق قسط" },
            ]}
            optionType="button"
            buttonStyle="solid"
            block
          />
        ) : (
          <Radio.Group
            className="w-full"
            value={mode}
            onChange={(e) => {
              const next = e.target.value as RecurringPaymentMode;
              setMode(next);
              if (next === "postpone") setPartialEnabled(false);
            }}
            options={[
              { value: "full", label: "تسویه / پرداخت" },
              { value: "postpone", label: "تعویق سررسید" },
            ]}
            optionType="button"
            buttonStyle="solid"
            block
          />
        )}

        {mode === "postpone" ? (
          <Space orientation="vertical" size="small" className="w-full">
            {item.kind === "recurring" ? (
              <Text type="secondary" className="text-sm">
                قسط این ماه پرداخت نمی‌شود. یک بدهی یک‌باره به مبلغ{" "}
                {formatToman(baseAmount)} ثبت می‌شود و قسط ماه بعد{" "}
                {postponePreview ? formatToman(postponePreview) : "—"} خواهد بود.
              </Text>
            ) : (
              <Text type="secondary" className="text-sm">
                پرداختی ثبت نمی‌شود و سررسید این بدهی به تاریخ جدید منتقل می‌شود.
              </Text>
            )}
            <div>
              <Text type="secondary" className="mb-1 block text-xs">
                {item.kind === "recurring" ? "تاریخ بدهی تعویق‌شده" : "تاریخ سررسید جدید"}
              </Text>
              <JalaliDateInput value={postponeDueDate} onChange={setPostponeDueDate} />
            </div>
          </Space>
        ) : (
          <>
            <Checkbox
              checked={partialEnabled}
              onChange={(e) => {
                setPartialEnabled(e.target.checked);
                setMode("full");
              }}
            >
              پرداخت جزئی
            </Checkbox>

            {showPartialOptions ? (
              <Space orientation="vertical" size="small" className="w-full">
                <div>
                  <Text type="secondary" className="mb-1 block text-xs">
                    مبلغ پرداختی (تومان)
                  </Text>
                  <AmountInput value={paidAmount} onChange={setPaidAmount} />
                </div>

                {remainder > 0 ? (
                  <Text type="secondary" className="text-sm">
                    مانده: {formatToman(remainder)}
                  </Text>
                ) : null}

                <Radio.Group
                  className="w-full"
                  value={remainderHandling}
                  onChange={(e) => setRemainderHandling(e.target.value as RemainderHandling)}
                  options={[
                    ...(item.kind === "recurring"
                      ? [
                          {
                            value: "next_month" as const,
                            label: "افزودن مانده به قسط ماه بعد",
                          },
                        ]
                      : []),
                    {
                      value: "new_debt" as const,
                      label: "ثبت مانده به‌صورت بدهی جدا",
                    },
                  ]}
                />

                {remainderHandling === "next_month" && nextMonthPreview ? (
                  <Text type="secondary" className="text-sm">
                    مبلغ قسط ماه بعد: {formatToman(nextMonthPreview)}
                  </Text>
                ) : null}

                {remainderHandling === "new_debt" ? (
                  <div>
                    <Text type="secondary" className="mb-1 block text-xs">
                      تاریخ سررسید مانده
                    </Text>
                    <JalaliDateInput
                      value={remainderDueDate}
                      onChange={setRemainderDueDate}
                    />
                  </div>
                ) : null}
              </Space>
            ) : null}

            <div>
              <Text type="secondary" className="mb-1 block text-xs">
                حساب بانکی
              </Text>
              <Select
                className="w-full"
                placeholder="انتخاب حساب بانکی"
                value={accountId || defaultAccountId || undefined}
                onChange={setAccountId}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
              />
            </div>
          </>
        )}
      </Space>
    </AppModal>
  );
}
