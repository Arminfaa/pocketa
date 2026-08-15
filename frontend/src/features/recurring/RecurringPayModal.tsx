"use client";

import { useEffect, useMemo, useState } from "react";
import { App, Button, Checkbox, Flex, Input, Radio, Select, Space, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
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
import { TimeInput } from "@/components/ui/time-input";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { formatAmountInputValue, normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";
import { getTodayJalali } from "@/lib/transaction-helpers";
import { getNowTehranClockTime } from "@/lib/transaction-time";
import { goldKindRateLabel, isCoinGoldKind } from "@/components/ui/market-unit-amount-input";

const { Text } = Typography;

type DeductionRow = { key: string; title: string; amount: string };

function isAssetLinked(item: RecurringItem | null): boolean {
  if (!item) return false;
  const qty = item.assetQuantity;
  const t = item.assetType;
  return qty != null && qty > 0 && (t === "gold" || t === "usd" || t === "rial");
}

function variancePreview(
  item: RecurringItem,
  expected: number,
  settled: number
): { label: string; amount: number } | null {
  const diff = Math.abs(Math.round(settled) - Math.round(expected));
  if (diff < 1) return null;
  if (item.type === "income") {
    if (settled < expected) return { label: "کارمزد", amount: diff };
    return { label: "سود مازاد", amount: diff };
  }
  if (settled > expected) return { label: "کارمزد", amount: diff };
  return { label: "مابه‌التفاوت قیمت", amount: diff };
}

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
  const [settledAmount, setSettledAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [remainderHandling, setRemainderHandling] =
    useState<RemainderHandling>("new_debt");
  const [remainderDueDate, setRemainderDueDate] = useState("");
  const [postponeDueDate, setPostponeDueDate] = useState("");
  const [txDate, setTxDate] = useState("");
  const [txTime, setTxTime] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setAccountId(defaultAccountId);
    setMode("full");
    setPartialEnabled(false);
    setPaidAmount(formatAmountInputValue(item.amount));
    setSettledAmount(formatAmountInputValue(item.amount));
    setFeeAmount("");
    setDeductions([]);
    setRemainderHandling("new_debt");
    const due = normalizeJalaliDateInput(item.nextPaymentDate) || item.nextPaymentDate;
    const today = getTodayJalali();
    setRemainderDueDate(due < today ? today : due);
    setPostponeDueDate(item.nextPaymentDate);
    setTxDate(today);
    setTxTime(getNowTehranClockTime());
  }, [open, item, defaultAccountId]);

  const dueAmount = item?.amount ?? 0;
  const baseAmount = item?.baseAmount ?? dueAmount;
  const paidNumeric = parseAmountInput(paidAmount);
  const settledNumeric = parseAmountInput(settledAmount);
  const feeNumeric = parseAmountInput(feeAmount);
  const feeValue =
    Number.isFinite(feeNumeric) && feeNumeric > 0 ? Math.round(feeNumeric) : 0;
  const remainder =
    Number.isFinite(paidNumeric) && paidNumeric > 0 && paidNumeric < dueAmount
      ? dueAmount - paidNumeric
      : 0;

  const deductionTotal = useMemo(() => {
    return deductions.reduce((sum, row) => {
      const n = parseAmountInput(row.amount);
      return sum + (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    }, 0);
  }, [deductions]);

  const netExpected = Math.max(0, dueAmount - deductionTotal);

  useEffect(() => {
    if (!open || !item || partialEnabled || mode === "postpone") return;
    if (isAssetLinked(item)) return;
    const base = item.type === "income" ? (netExpected > 0 ? netExpected : item.amount) : item.amount;
    const implied =
      item.type === "income" ? Math.max(1, base - feeValue) : base + feeValue;
    setSettledAmount(formatAmountInputValue(implied));
  }, [feeValue, netExpected, open, item, partialEnabled, mode]);

  const assetLinked = isAssetLinked(item);
  const showSettledField = Boolean(item) && !partialEnabled && mode !== "postpone";
  const allowDeductions =
    Boolean(item) && item?.type === "income" && !partialEnabled && mode !== "postpone";

  const variance =
    item &&
    showSettledField &&
    Number.isFinite(settledNumeric) &&
    settledNumeric > 0
      ? variancePreview(item, netExpected > 0 ? netExpected : dueAmount, settledNumeric)
      : null;

  const nextMonthPreview = useMemo(() => {
    if (!item || !partialEnabled || mode === "postpone" || remainderHandling !== "next_month") {
      return null;
    }
    if (remainder <= 0) return null;
    return baseAmount + remainder;
  }, [item, partialEnabled, mode, remainderHandling, remainder, baseAmount]);

  const postponePreview = useMemo(() => {
    if (!item || mode !== "postpone") return null;
    return { deferred: dueAmount, nextInstallment: baseAmount };
  }, [item, mode, dueAmount, baseAmount]);

  const stageCount = item?.stageCount ?? item?.paymentDays?.length ?? 1;
  const stageIndex = item?.currentStageIndex ?? 0;

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

    const date = normalizeJalaliDateInput(txDate);
    if (!date) {
      message.error("تاریخ تراکنش را وارد کنید");
      return;
    }
    const time = txTime.trim();
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      message.error("ساعت باید به صورت HH:mm باشد");
      return;
    }

    if (!partialEnabled) {
      const parsedDeductions = deductions
        .map((row) => ({
          title: row.title.trim(),
          amount: Math.round(parseAmountInput(row.amount) || 0),
        }))
        .filter((d) => d.title.length > 0 && d.amount > 0);

      if (parsedDeductions.length > 0) {
        const total = parsedDeductions.reduce((s, d) => s + d.amount, 0);
        if (total >= dueAmount) {
          message.error("جمع کسورات باید کمتر از مبلغ سررسید باشد");
          return;
        }
      }

      const settled = parseAmountInput(settledAmount);
      if (!Number.isFinite(settled) || settled <= 0) {
        message.error(
          item.type === "income" ? "مبلغ دریافتی معتبر نیست" : "مبلغ پرداختی معتبر نیست"
        );
        return;
      }
      const payload: GenerateRecurringPayload = {
        mode: "full",
        accountId: acc,
        date,
        time: time || undefined,
      };
      if (parsedDeductions.length > 0) {
        payload.deductions = parsedDeductions;
      }
      if (feeValue > 0) payload.feeAmount = feeValue;
      const expectedNet = dueAmount - parsedDeductions.reduce((s, d) => s + d.amount, 0);
      const impliedSettled = isReceivable
        ? Math.max(1, expectedNet - feeValue)
        : expectedNet + feeValue;
      if (Math.round(settled) !== Math.round(impliedSettled) && Math.round(settled) !== Math.round(expectedNet)) {
        payload.settledAmount = Math.round(settled);
      } else if (feeValue > 0) {
        payload.settledAmount = impliedSettled;
      } else if (assetLinked) {
        payload.settledAmount = Math.round(settled);
      }
      onSubmit(payload);
      return;
    }

    const paid = parseAmountInput(paidAmount);
    const amountWord = item.type === "income" ? "مبلغ دریافتی" : "مبلغ پرداختی";
    if (!Number.isFinite(paid) || paid <= 0) {
      message.error(`${amountWord} معتبر نیست`);
      return;
    }
    if (paid >= dueAmount) {
      message.error(`${amountWord} باید کمتر از مبلغ قسط باشد`);
      return;
    }

    const payload: GenerateRecurringPayload = {
      mode: "partial",
      accountId: acc,
      paidAmount: paid,
      remainderHandling,
      date,
      time: time || undefined,
    };
    if (feeValue > 0) payload.feeAmount = feeValue;

    if (remainderHandling === "new_debt") {
      const remDate = normalizeJalaliDateInput(remainderDueDate);
      if (!remDate) {
        message.error("تاریخ سررسید مانده را وارد کنید");
        return;
      }
      payload.remainderDueDate = remDate;
    }

    onSubmit(payload);
  }

  if (!item) return null;

  const isReceivable = item.type === "income";
  const singularLabel = isReceivable ? "طلب" : "بدهی";
  const showPartialOptions = partialEnabled && mode !== "postpone";
  const effectiveMode: RecurringPaymentMode =
    mode === "postpone" ? "postpone" : partialEnabled ? "partial" : "full";

  const settledLabel =
    isReceivable
      ? deductionTotal > 0
        ? "مبلغ خالص دریافتی (تومان)"
        : "مبلغ دریافتی واقعی (تومان)"
      : "مبلغ پرداختی واقعی (تومان)";

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
            {assetLinked
              ? "مبلغ محاسبه‌شده (قیمت روز)"
              : stageCount > 1
                ? `مبلغ مرحله ${toPersianDigits(String(stageIndex + 1))} از ${toPersianDigits(String(stageCount))}`
                : "مبلغ سررسید"}
          </Text>
          <div>
            <Text strong className="text-base">
              {formatToman(dueAmount)}
            </Text>
            {stageCount > 1 || dueAmount !== baseAmount ? (
              <Text type="secondary" className="text-xs ms-2">
                (ماهانه {formatToman(baseAmount)})
              </Text>
            ) : null}
          </div>
          {assetLinked && item.assetQuantity != null ? (
            <Text type="secondary" className="text-xs block">
              {item.assetType === "usd"
                ? `${item.assetQuantity} دلار`
                : item.assetType === "gold" && isCoinGoldKind(item.goldKind)
                  ? `${item.assetQuantity} ${goldKindRateLabel(item.goldKind ?? "melted")}`
                  : `${item.assetQuantity} گرم طلا`}
            </Text>
          ) : null}
          <Text type="secondary" className="text-xs">
            موعد: {formatJalaliDate(item.nextPaymentDate)}
          </Text>
        </div>

        <Radio.Group
          className="w-full"
          value={mode}
          onChange={(e) => {
            const next = e.target.value as RecurringPaymentMode;
            setMode(next);
            if (next === "postpone") setPartialEnabled(false);
          }}
          options={[
            {
              value: "full",
              label: isReceivable ? "تسویه / دریافت" : "تسویه / پرداخت",
            },
            {
              value: "postpone",
              label: item.kind === "recurring" ? "تعویق قسط" : "تعویق سررسید",
            },
          ]}
          optionType="button"
          buttonStyle="solid"
          block
        />

        {mode === "postpone" ? (
          <Space orientation="vertical" size="small" className="w-full">
            {item.kind === "recurring" ? (
              <Text type="secondary" className="text-sm">
                {isReceivable
                  ? "قسط این موعد دریافت نمی‌شود. یک طلب یک‌باره به مبلغ "
                  : "قسط این موعد پرداخت نمی‌شود. یک بدهی یک‌باره به مبلغ "}
                {postponePreview ? formatToman(postponePreview.deferred) : "—"} ثبت
                می‌شود و موعد بعدی به‌روز می‌شود.
              </Text>
            ) : (
              <Text type="secondary" className="text-sm">
                {isReceivable
                  ? "دریافتی ثبت نمی‌شود و سررسید این طلب به تاریخ جدید منتقل می‌شود."
                  : "پرداختی ثبت نمی‌شود و سررسید این بدهی به تاریخ جدید منتقل می‌شود."}
              </Text>
            )}
            <div>
              <Text type="secondary" className="mb-1 block text-xs">
                {item.kind === "recurring"
                  ? `تاریخ ${singularLabel} تعویق‌شده`
                  : "تاریخ سررسید جدید"}
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
                if (e.target.checked) setDeductions([]);
              }}
            >
              {isReceivable ? "دریافت جزئی" : "پرداخت جزئی"}
            </Checkbox>

            {showPartialOptions ? (
              <Space orientation="vertical" size="small" className="w-full">
                <div>
                  <Text type="secondary" className="mb-1 block text-xs">
                    {isReceivable ? "مبلغ دریافتی (تومان)" : "مبلغ پرداختی (تومان)"}
                  </Text>
                  <AmountInput value={paidAmount} onChange={setPaidAmount} />
                </div>

                {remainder > 0 ? (
                  <Text type="secondary" className="text-sm">
                    مانده: {formatToman(remainder)}
                  </Text>
                ) : null}

                <div>
                  <Text type="secondary" className="mb-1 block text-xs">
                    کارمزد (اختیاری)
                  </Text>
                  <AmountInput value={feeAmount} onChange={setFeeAmount} />
                  {feeValue > 0 && Number.isFinite(paidNumeric) ? (
                    <Text type="secondary" className="mt-1 block text-xs">
                      {isReceivable
                        ? `خالص دریافتی: ${formatToman(Math.max(0, Math.round(paidNumeric) - feeValue))}`
                        : `جمع برداشت: ${formatToman(Math.round(paidNumeric) + feeValue)}`}
                    </Text>
                  ) : null}
                </div>

                <Radio.Group
                  className="w-full"
                  value={remainderHandling}
                  onChange={(e) => setRemainderHandling(e.target.value as RemainderHandling)}
                  options={[
                    {
                      value: "new_debt" as const,
                      label: `ثبت مانده به‌صورت ${singularLabel} جدا`,
                    },
                    ...(item.kind === "recurring"
                      ? [
                          {
                            value: "next_month" as const,
                            label: "افزودن مانده به قسط ماه بعد",
                          },
                        ]
                      : []),
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
            ) : (
              <Space orientation="vertical" size="small" className="w-full">
                {allowDeductions ? (
                  <div className="rounded-xl border border-slate-400/15 p-3">
                    <Flex justify="space-between" align="center" className="mb-2">
                      <Text type="secondary" className="text-xs">
                        کسورات (اختیاری)
                      </Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          setDeductions((prev) => [
                            ...prev,
                            {
                              key: `${Date.now()}-${prev.length}`,
                              title: "",
                              amount: "",
                            },
                          ])
                        }
                      >
                        افزودن
                      </Button>
                    </Flex>
                    {deductions.length === 0 ? (
                      <Text type="secondary" className="text-xs">
                        مثلاً بیمه، مالیات یا وام — از مبلغ ناخالص کم می‌شود.
                      </Text>
                    ) : (
                      <Space orientation="vertical" size="small" className="w-full">
                        {deductions.map((row) => (
                          <Flex key={row.key} gap="small" align="start" className="w-full">
                            <Input
                              className="flex-1"
                              placeholder="عنوان کسور"
                              value={row.title}
                              onChange={(e) =>
                                setDeductions((prev) =>
                                  prev.map((d) =>
                                    d.key === row.key ? { ...d, title: e.target.value } : d
                                  )
                                )
                              }
                            />
                            <div className="w-36 shrink-0">
                              <AmountInput
                                value={row.amount}
                                onChange={(v) =>
                                  setDeductions((prev) =>
                                    prev.map((d) =>
                                      d.key === row.key ? { ...d, amount: v } : d
                                    )
                                  )
                                }
                              />
                            </div>
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() =>
                                setDeductions((prev) => prev.filter((d) => d.key !== row.key))
                              }
                            />
                          </Flex>
                        ))}
                        {deductionTotal > 0 ? (
                          <Text type="secondary" className="text-sm">
                            جمع کسورات: {formatToman(deductionTotal)} → خالص{" "}
                            {formatToman(netExpected)}
                          </Text>
                        ) : null}
                      </Space>
                    )}
                  </div>
                ) : null}

                <div>
                  <Text type="secondary" className="mb-1 block text-xs">
                    کارمزد (اختیاری)
                  </Text>
                  <AmountInput value={feeAmount} onChange={setFeeAmount} />
                  {feeValue > 0 ? (
                    <Text type="secondary" className="mt-1 block text-xs">
                      {isReceivable
                        ? `خالص دریافتی از حساب: ${formatToman(Math.max(0, dueAmount - feeValue))}`
                        : `جمع برداشت از حساب: ${formatToman(dueAmount + feeValue)}`}
                    </Text>
                  ) : null}
                </div>

                <div>
                  <Text type="secondary" className="mb-1 block text-xs">
                    {settledLabel}
                  </Text>
                  <AmountInput value={settledAmount} onChange={setSettledAmount} />
                </div>
                {assetLinked ? (
                  <Text type="secondary" className="text-xs">
                    اگر با مبلغ محاسبه‌شده فرق دارد، اختلاف به‌صورت خودکار ثبت می‌شود.
                  </Text>
                ) : deductionTotal > 0 ? (
                  <Text type="secondary" className="text-xs">
                    درآمد به‌صورت ناخالص ثبت می‌شود و هر کسور به‌صورت هزینه جداگانه.
                  </Text>
                ) : (
                  <Text type="secondary" className="text-xs">
                    در صورت اختلاف با سررسید، مازاد/کسری به‌صورت کارمزد، سود مازاد یا
                    مابه‌التفاوت قیمت ثبت می‌شود.
                  </Text>
                )}
                {variance ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <Text className="text-sm">
                      اختلاف: {formatToman(variance.amount)} → {variance.label}
                    </Text>
                    <Text type="secondary" className="text-xs block">
                      اثر خالص روی موجودی:{" "}
                      {formatToman(
                        Number.isFinite(settledNumeric) ? Math.round(settledNumeric) : netExpected
                      )}
                    </Text>
                  </div>
                ) : null}
              </Space>
            )}

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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Text type="secondary" className="mb-1 block text-xs">
                  تاریخ تراکنش
                </Text>
                <JalaliDateInput value={txDate} onChange={setTxDate} />
              </div>
              <div>
                <Text type="secondary" className="mb-1 block text-xs">
                  ساعت
                </Text>
                <TimeInput value={txTime} onChange={setTxTime} />
              </div>
            </div>
          </>
        )}
      </Space>
    </AppModal>
  );
}
