"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Checkbox,
  Col,
  Flex,
  Grid,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import {
  CheckOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  fetchCategories,
  fetchTransactions,
  suggestCategory,
  updateTransaction,
} from "@/services/transactions";
import { fetchRecurring } from "@/services/recurring";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import {
  categoryIdValue,
  categoryName,
  accountName,
} from "@/lib/transaction-helpers";
import { normalizeJalaliDateInput } from "@/lib/amount";
import { ReviewListSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { TagsInput } from "@/components/ui/tags-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { cn } from "@/lib/cn";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { AmountText } from "@/components/ui/amount-text";

const { Text } = Typography;

type Draft = {
  title: string;
  categoryId: string;
  tags: string[];
  registerAsDebt: boolean;
  debtDueDate: string;
  linkToRecurring: boolean;
  settleRecurringId: string;
  settleMode: "full" | "partial";
  remainderDueDate: string;
};

const AUTO_REVIEW_TITLE_INCOME = "واریز بررسی‌شده";
const AUTO_REVIEW_TITLE_EXPENSE = "برداشت بررسی‌شده";

function defaultDraft(tx: Transaction): Draft {
  return {
    title: tx.title.includes("بدون عنوان") ? "" : tx.title,
    categoryId: categoryIdValue(tx.categoryId),
    tags: tx.tags ?? [],
    registerAsDebt: false,
    debtDueDate: "",
    linkToRecurring: false,
    settleRecurringId: "",
    settleMode: "full",
    remainderDueDate: "",
  };
}

function obligationLabel(type: "income" | "expense") {
  return type === "income"
    ? "ثبت به‌عنوان بدهی (تراکنش مثبت + سررسید بازپرداخت)"
    : "ثبت به‌عنوان طلب (تراکنش منفی + سررسید دریافت)";
}

/** عنوان نهایی برای ذخیره؛ در حالت گروهی اگر خالی باشد خودکار نام می‌گذارد. */
function resolveSaveTitle(
  tx: Transaction,
  draft: Draft,
  opts?: { autoTitleIfEmpty?: boolean }
): string {
  const trimmed = draft.title.trim();
  if (trimmed.length >= 2) return trimmed;

  if (opts?.autoTitleIfEmpty) {
    const cleaned = tx.title
      .replace(/\s*\(بدون عنوان\)\s*/g, " ")
      .replace(/\s*بدون عنوان\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length >= 2) return cleaned;
    return tx.type === "income" ? AUTO_REVIEW_TITLE_INCOME : AUTO_REVIEW_TITLE_EXPENSE;
  }

  throw new Error(`عنوان «${tx.title}» حداقل ۲ کاراکتر باشد`);
}

export default function ReviewPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const listQ = useQuery({
    queryKey: ["transactions", "review", selectedAccountId],
    queryFn: () =>
      fetchTransactions({
        page: 1,
        limit: 50,
        needsReview: true,
        accountId: selectedAccountId,
        sortBy: "date",
        sortOrder: "desc",
      }),
  });

  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const recurringQ = useQuery({ queryKey: ["recurring"], queryFn: fetchRecurring });

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const items = listQ.data?.items ?? [];
  const pageIds = useMemo(() => items.map((tx) => tx._id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.some((id) => pageIds.includes(id));

  function getDraft(tx: Transaction): Draft {
    return drafts[tx._id] ?? defaultDraft(tx);
  }

  function setDraft(txId: string, draft: Draft) {
    setDrafts((d) => ({ ...d, [txId]: draft }));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    );
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? pageIds : []);
  }

  async function saveOne(tx: Transaction, opts?: { autoTitleIfEmpty?: boolean }) {
    const draft = getDraft(tx);
    const title = resolveSaveTitle(tx, draft, opts);

    if (draft.registerAsDebt && draft.linkToRecurring) {
      throw new Error(`برای «${title}» فقط یکی از بدهی/طلب جدید یا تسویه سررسید را انتخاب کنید`);
    }
    if (draft.registerAsDebt && !draft.debtDueDate.trim()) {
      throw new Error(`برای «${title}» تاریخ سررسید را وارد کنید`);
    }
    if (draft.linkToRecurring && !draft.settleRecurringId) {
      throw new Error(`برای «${title}» سررسید را انتخاب کنید`);
    }
    if (draft.linkToRecurring && draft.settleRecurringId) {
      const item = (recurringQ.data?.items ?? []).find((i) => i.id === draft.settleRecurringId);
      if (!item) throw new Error("سررسید انتخاب‌شده یافت نشد");
      if (item.type !== tx.type) {
        throw new Error("نوع سررسید با نوع تراکنش همخوانی ندارد");
      }
      if (draft.settleMode === "full" && Math.round(tx.amount) !== Math.round(item.amount)) {
        throw new Error(
          `تسویه کامل نیست؛ مبلغ تراکنش (${formatToman(tx.amount)}) با مبلغ سررسید (${formatToman(item.amount)}) یکی نیست`
        );
      }
      if (draft.settleMode === "partial" && tx.amount >= item.amount) {
        throw new Error("برای مبلغ مساوی یا بیشتر، تسویه کامل را انتخاب کنید");
      }
      if (draft.settleMode === "partial" && !draft.remainderDueDate.trim()) {
        throw new Error(`برای «${title}» تاریخ تسویه مانده را وارد کنید`);
      }
    }

    await updateTransaction(tx._id, {
      title,
      categoryId: draft.categoryId || categoryIdValue(tx.categoryId),
      tags: draft.tags,
      needsReview: false,
      registerAsDebt: draft.registerAsDebt,
      debtDueDate: draft.registerAsDebt
        ? normalizeJalaliDateInput(draft.debtDueDate)
        : undefined,
      settleRecurringId: draft.linkToRecurring ? draft.settleRecurringId : undefined,
      settleMode: draft.linkToRecurring ? draft.settleMode : undefined,
      remainderDueDate:
        draft.linkToRecurring && draft.settleMode === "partial"
          ? normalizeJalaliDateInput(draft.remainderDueDate)
          : undefined,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const draft = getDraft(tx);
      await saveOne(tx);
      return {
        id: tx._id,
        asDebt: draft.registerAsDebt,
        asSettle: draft.linkToRecurring,
        txType: tx.type,
      };
    },
    onSuccess: ({ id, asDebt, asSettle, txType }) => {
      message.success(
        asSettle
          ? "ذخیره شد، سررسید تسویه شد و از بررسی خارج شد"
          : asDebt
            ? txType === "income"
              ? "ذخیره شد، بدهی یک‌باره ثبت شد و از بررسی خارج شد"
              : "ذخیره شد، طلب یک‌باره ثبت شد و از بررسی خارج شد"
            : "ذخیره شد و از بررسی خارج شد"
      );
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (asDebt || asSettle) {
        void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره";
      message.error(msg);
    },
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const selected = items.filter((tx) => ids.includes(tx._id));
      if (selected.length === 0) throw new Error("موردی انتخاب نشده");

      const invalidDebt = selected.find(
        (tx) => getDraft(tx).registerAsDebt && !getDraft(tx).debtDueDate.trim()
      );
      if (invalidDebt) {
        throw new Error("برای موارد بدهی/طلب‌دار، تاریخ سررسید را وارد کنید");
      }

      const invalidSettle = selected.find(
        (tx) => getDraft(tx).linkToRecurring && !getDraft(tx).settleRecurringId
      );
      if (invalidSettle) {
        throw new Error("برای موارد متصل به سررسید، یک سررسید انتخاب کنید");
      }

      const invalidRemainder = selected.find(
        (tx) =>
          getDraft(tx).linkToRecurring &&
          getDraft(tx).settleMode === "partial" &&
          !getDraft(tx).remainderDueDate.trim()
      );
      if (invalidRemainder) {
        throw new Error("برای پرداخت جزئی، تاریخ تسویه مانده را وارد کنید");
      }

      const anyLinked = selected.some(
        (tx) => getDraft(tx).registerAsDebt || getDraft(tx).linkToRecurring
      );
      const results = await Promise.allSettled(
        selected.map((tx) => saveOne(tx, { autoTitleIfEmpty: true }))
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok === 0) {
        const firstErr = results.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        const reason = firstErr?.reason;
        throw new Error(
          reason instanceof Error ? reason.message : "هیچ موردی ذخیره نشد"
        );
      }
      return { ok, failed, ids: selected.map((t) => t._id), anyLinked };
    },
    onSuccess: ({ ok, failed, ids, anyLinked }) => {
      if (failed > 0) {
        message.warning(
          `${toPersianDigits(String(ok))} مورد ذخیره شد، ${toPersianDigits(String(failed))} مورد ناموفق`
        );
      } else {
        message.success(
          `${toPersianDigits(String(ok))} مورد ذخیره و از بررسی خارج شد`
        );
      }
      setDrafts((d) => {
        const next = { ...d };
        for (const id of ids) delete next[id];
        return next;
      });
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (anyLinked) {
        void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      }
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره گروهی";
      message.error(msg);
    },
  });

  const suggestMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const draft = getDraft(tx);
      const title = draft.title.trim() || tx.description || tx.title;
      return suggestCategory({ title, type: tx.type });
    },
    onSuccess: (result, tx) => {
      if (!result.suggestion) {
        message.info("پیشنهادی پیدا نشد");
        return;
      }
      const draft = getDraft(tx);
      setDraft(tx._id, { ...draft, categoryId: result.suggestion!._id });
      message.success(`پیشنهاد: ${result.suggestion.name}`);
    },
  });

  const selectedOnPage = selectedIds.filter((id) => pageIds.includes(id));

  return (
    <PageShell width="form">
      <PageHeader
        title="نام‌گذاری تراکنش‌های ایمپورت‌شده"
        icon={<WarningOutlined />}
        description="موارد را تکی یا گروهی انتخاب کنید، عنوان بگذارید، سپس ذخیره و خروج از بررسی کنید."
      />

      {listQ.isLoading ? <ReviewListSkeleton /> : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="موردی برای بررسی نیست"
          description="از صفحه ایمپورت پیامک بانکی شروع کنید تا تراکنش‌های جدید اینجا بیایند."
        />
      ) : null}

      {items.length > 0 ? (
        <SectionCard flush bodyClassName="p-0">
          <Flex justify="space-between" align="center" gap="middle" wrap="wrap" className="px-4 py-3.5 sm:px-5">
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onChange={(e) => toggleSelectAll(e.target.checked)}
            >
              انتخاب همه ({toPersianDigits(String(items.length))})
            </Checkbox>

            <Button
              type="primary"
              icon={<CheckOutlined />}
              disabled={selectedOnPage.length === 0}
              loading={bulkSaveMutation.isPending}
              onClick={() => bulkSaveMutation.mutate(selectedOnPage)}
            >
              ذخیره و خروج از بررسی
              {selectedOnPage.length > 0
                ? ` (${toPersianDigits(String(selectedOnPage.length))})`
                : ""}
            </Button>
          </Flex>
        </SectionCard>
      ) : null}

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((tx) => {
          const draft = getDraft(tx);
          const cats = (categoriesQ.data ?? []).filter((c) => c.type === tx.type);
          const checked = selectedIds.includes(tx._id);

          return (
            <SectionCard
              key={tx._id}
              className={cn(checked && "ring-1 ring-brand-500/40")}
              title={
                <Checkbox
                  checked={checked}
                  onChange={(e) => toggleSelect(tx._id, e.target.checked)}
                >
                  <Text type="secondary" className="text-xs font-normal">
                    انتخاب برای ذخیره گروهی
                  </Text>
                </Checkbox>
              }
            >
              <Space orientation="vertical" size="middle" className="w-full">
                <Flex
                  justify="space-between"
                  align="flex-start"
                  gap="middle"
                  wrap="wrap"
                  vertical={isMobile}
                >
                  <Text type="secondary" className="text-sm min-w-0 break-words flex-1">
                    {formatJalaliDate(tx.date)}
                    {tx.bankMeta?.time ? ` · ${tx.bankMeta.time}` : ""}
                    {" · "}
                    {accountName(tx.accountId)}
                    {" · "}
                    {categoryName(tx.categoryId)}
                  </Text>
                  <AmountText
                    tone={tx.type === "income" ? "income" : "expense"}
                    size="sm"
                    prefix={tx.type === "income" ? "+" : "-"}
                  >
                    {formatToman(tx.amount)}
                  </AmountText>
                </Flex>

                <Input
                  placeholder="مثلاً اجاره / حقوق / خرید لپ‌تاپ"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft(tx._id, { ...draft, title: e.target.value })
                  }
                  onBlur={() => {
                    if (draft.title.trim().length >= 2) {
                      suggestMutation.mutate(tx);
                    }
                  }}
                />

                <Row gutter={[12, 12]}>
                  <Col xs={24} md={14}>
                    <Flex gap="small" align="center" wrap="wrap">
                      <Select
                        className="min-w-0 flex-1"
                        value={draft.categoryId}
                        onChange={(categoryId) =>
                          setDraft(tx._id, { ...draft, categoryId })
                        }
                        options={cats.map((c) => ({ value: c._id, label: c.name }))}
                      />
                      <Button
                        type="default"
                        icon={<ThunderboltOutlined />}
                        title="پیشنهاد دسته از عنوان"
                        loading={suggestMutation.isPending}
                        onClick={() => suggestMutation.mutate(tx)}
                      />
                    </Flex>
                  </Col>
                  <Col xs={24} md={10}>
                    <TagsInput
                      value={draft.tags}
                      onChange={(tags) => setDraft(tx._id, { ...draft, tags })}
                    />
                  </Col>
                </Row>

                <Checkbox
                  checked={draft.registerAsDebt}
                  disabled={draft.linkToRecurring}
                  onChange={(e) =>
                    setDraft(tx._id, {
                      ...draft,
                      registerAsDebt: e.target.checked,
                      debtDueDate: e.target.checked ? draft.debtDueDate : "",
                      linkToRecurring: e.target.checked ? false : draft.linkToRecurring,
                      settleRecurringId: e.target.checked ? "" : draft.settleRecurringId,
                    })
                  }
                >
                  {obligationLabel(tx.type)}
                </Checkbox>

                {draft.registerAsDebt ? (
                  <div>
                    <Text type="secondary" className="mb-1 block text-xs">
                      {tx.type === "income" ? "تاریخ پس دادن بدهی" : "تاریخ دریافت طلب"}
                    </Text>
                    <JalaliDateInput
                      value={draft.debtDueDate}
                      onChange={(debtDueDate) =>
                        setDraft(tx._id, { ...draft, debtDueDate })
                      }
                      placeholder="1405/05/01"
                    />
                    <Text type="secondary" className="mt-1 block text-xs">
                      {tx.type === "income"
                        ? "همان مبلغ در جریان دوره‌ای به‌عنوان بدهی یک‌باره ثبت می‌شود."
                        : "همان مبلغ در جریان دوره‌ای به‌عنوان طلب یک‌باره ثبت می‌شود."}
                    </Text>
                  </div>
                ) : null}

                <Checkbox
                  checked={draft.linkToRecurring}
                  disabled={draft.registerAsDebt}
                  onChange={(e) =>
                    setDraft(tx._id, {
                      ...draft,
                      linkToRecurring: e.target.checked,
                      settleRecurringId: e.target.checked ? draft.settleRecurringId : "",
                      registerAsDebt: e.target.checked ? false : draft.registerAsDebt,
                      debtDueDate: e.target.checked ? "" : draft.debtDueDate,
                    })
                  }
                >
                  اتصال به سررسید موجود (تسویه از جریان دوره‌ای)
                </Checkbox>

                {draft.linkToRecurring ? (
                  <div className="flex flex-col gap-2">
                    <Select
                      showSearch
                      optionFilterProp="label"
                      className="w-full"
                      placeholder="انتخاب سررسید"
                      value={draft.settleRecurringId || undefined}
                      onChange={(settleRecurringId) =>
                        setDraft(tx._id, { ...draft, settleRecurringId })
                      }
                      options={(recurringQ.data?.items ?? [])
                        .filter((i) => i.active && i.type === tx.type)
                        .map((i) => ({
                          value: i.id,
                          label: `${i.title} · ${formatToman(i.amount)} · ${i.nextPaymentDate}`,
                        }))}
                      notFoundContent="سررسید فعالی با این نوع تراکنش نیست"
                    />
                    <Radio.Group
                      value={draft.settleMode}
                      onChange={(e) =>
                        setDraft(tx._id, {
                          ...draft,
                          settleMode: e.target.value as "full" | "partial",
                        })
                      }
                    >
                      <Radio value="full">تسویه کامل</Radio>
                      <Radio value="partial">پرداخت جزئی</Radio>
                    </Radio.Group>
                    {draft.settleMode === "full" && draft.settleRecurringId ? (
                      <Text type="secondary" className="text-xs">
                        مبلغ تراکنش باید دقیقاً برابر مبلغ سررسید باشد؛ در غیر این صورت ارور
                        می‌گیرید.
                      </Text>
                    ) : null}
                    {draft.settleMode === "partial" ? (
                      <div>
                        <Text type="secondary" className="mb-1 block text-xs">
                          تاریخ تسویه مانده
                        </Text>
                        <JalaliDateInput
                          value={draft.remainderDueDate}
                          onChange={(remainderDueDate) =>
                            setDraft(tx._id, { ...draft, remainderDueDate })
                          }
                          placeholder="1405/05/01"
                        />
                        <Text type="secondary" className="mt-1 block text-xs">
                          مانده به‌صورت سررسید جدا با این تاریخ ثبت می‌شود.
                        </Text>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={saveMutation.isPending && saveMutation.variables?._id === tx._id}
                  onClick={() => saveMutation.mutate(tx)}
                >
                  {draft.linkToRecurring
                    ? "ذخیره، تسویه سررسید و خروج از بررسی"
                    : draft.registerAsDebt
                      ? tx.type === "income"
                        ? "ذخیره، ثبت بدهی و خروج از بررسی"
                        : "ذخیره، ثبت طلب و خروج از بررسی"
                      : "ذخیره و خروج از بررسی"}
                </Button>
              </Space>
            </SectionCard>
          );
        })}
      </Space>
    </PageShell>
  );
}
