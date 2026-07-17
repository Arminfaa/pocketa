"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Flex,
  Grid,
  Input,
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
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import {
  categoryIdValue,
  categoryName,
  accountName,
} from "@/lib/transaction-helpers";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TagsInput } from "@/components/ui/tags-input";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

type Draft = { title: string; categoryId: string; tags: string[] };

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

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const items = listQ.data?.items ?? [];
  const pageIds = useMemo(() => items.map((tx) => tx._id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const someSelected = selectedIds.some((id) => pageIds.includes(id));

  function getDraft(tx: Transaction): Draft {
    return (
      drafts[tx._id] ?? {
        title: tx.title.includes("بدون عنوان") ? "" : tx.title,
        categoryId: categoryIdValue(tx.categoryId),
        tags: tx.tags ?? [],
      }
    );
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

  async function saveOne(tx: Transaction) {
    const draft = getDraft(tx);
    if (draft.title.trim().length < 2) {
      throw new Error(`عنوان «${tx.title}» حداقل ۲ کاراکتر باشد`);
    }
    await updateTransaction(tx._id, {
      title: draft.title.trim(),
      categoryId: draft.categoryId || categoryIdValue(tx.categoryId),
      tags: draft.tags,
      needsReview: false,
    });
  }

  const saveMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      await saveOne(tx);
      return tx._id;
    },
    onSuccess: (id) => {
      message.success("ذخیره شد و از بررسی خارج شد");
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

      const invalid = selected.find((tx) => getDraft(tx).title.trim().length < 2);
      if (invalid) {
        throw new Error("برای همه موارد انتخاب‌شده عنوان حداقل ۲ کاراکتری وارد کنید");
      }

      const results = await Promise.allSettled(selected.map((tx) => saveOne(tx)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      if (ok === 0) throw new Error("هیچ موردی ذخیره نشد");
      return { ok, failed, ids: selected.map((t) => t._id) };
    },
    onSuccess: ({ ok, failed, ids }) => {
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
    <Space orientation="vertical" size="middle" className="w-full max-w-3xl">
      <div>
        <Title level={4} className="!m-0 whitespace-normal">
          <Flex wrap="wrap" gap="small" align="center">
            <WarningOutlined className="text-brandGold-400" />
            نام‌گذاری تراکنش‌های ایمپورت‌شده
          </Flex>
        </Title>
        <Text type="secondary">
          موارد را تکی یا گروهی انتخاب کنید، عنوان بگذارید، سپس ذخیره و خروج از بررسی کنید.
        </Text>
      </div>

      {listQ.isLoading ? <Skeleton className="h-48 w-full" /> : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="موردی برای بررسی نیست"
          description="از صفحه ایمپورت پیامک بانکی شروع کنید تا تراکنش‌های جدید اینجا بیایند."
        />
      ) : null}

      {items.length > 0 ? (
        <Card size="small">
          <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
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
        </Card>
      ) : null}

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((tx) => {
          const draft = getDraft(tx);
          const cats = (categoriesQ.data ?? []).filter((c) => c.type === tx.type);
          const checked = selectedIds.includes(tx._id);

          return (
            <Card
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
                  <Text
                    strong
                    className={cn(
                      tx.type === "income" ? "text-emerald-500" : "text-red-500",
                      "font-semibold"
                    )}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatToman(tx.amount)}
                  </Text>
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

                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={saveMutation.isPending && saveMutation.variables?._id === tx._id}
                  onClick={() => saveMutation.mutate(tx)}
                >
                  ذخیره و خروج از بررسی
                </Button>
              </Space>
            </Card>
          );
        })}
      </Space>
    </Space>
  );
}
