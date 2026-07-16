"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Flex, Grid, Input, Select, Space, Typography } from "antd";
import { CheckOutlined, WarningOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  fetchCategories,
  fetchTransactions,
  suggestCategory,
  updateTransaction,
} from "@/services/transactions";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman } from "@/lib/format";
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

  const [drafts, setDrafts] = useState<
    Record<string, { title: string; categoryId: string; tags: string[] }>
  >({});

  function getDraft(tx: Transaction) {
    return (
      drafts[tx._id] ?? {
        title: tx.title.includes("بدون عنوان") ? "" : tx.title,
        categoryId: categoryIdValue(tx.categoryId),
        tags: tx.tags ?? [],
      }
    );
  }

  const saveMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      const draft = getDraft(tx);
      if (draft.title.trim().length < 2) {
        throw new Error("عنوان حداقل ۲ کاراکتر باشد");
      }
      return updateTransaction(tx._id, {
        title: draft.title.trim(),
        categoryId: draft.categoryId || categoryIdValue(tx.categoryId),
        tags: draft.tags,
        needsReview: false,
      });
    },
    onSuccess: (_data, tx) => {
      message.success("عنوان ذخیره شد");
      setDrafts((d) => {
        const next = { ...d };
        delete next[tx._id];
        return next;
      });
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
      setDrafts((d) => ({
        ...d,
        [tx._id]: { ...draft, categoryId: result.suggestion!._id },
      }));
      message.success(`پیشنهاد: ${result.suggestion.name}`);
    },
  });

  const items = listQ.data?.items ?? [];

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
          برای هر واریز/برداشت مشخص کنید برای چه بوده، سپس ذخیره کنید.
        </Text>
      </div>

      {listQ.isLoading ? <Skeleton className="h-48 w-full" /> : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="موردی برای بررسی نیست"
          description="از صفحه ایمپورت پیامک بانکی شروع کنید تا تراکنش‌های جدید اینجا بیایند."
        />
      ) : null}

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((tx) => {
          const draft = getDraft(tx);
          const cats = (categoriesQ.data ?? []).filter((c) => c.type === tx.type);
          return (
            <Card key={tx._id}>
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
                    setDrafts((d) => ({
                      ...d,
                      [tx._id]: { ...draft, title: e.target.value },
                    }))
                  }
                  onBlur={() => {
                    if (draft.title.trim().length >= 2) {
                      suggestMutation.mutate(tx);
                    }
                  }}
                />

                <Flex gap="small" align="center" wrap="wrap">
                  <Select
                    className={cn("flex-1", isMobile ? "min-w-full" : "min-w-40")}
                    value={draft.categoryId}
                    onChange={(categoryId) =>
                      setDrafts((d) => ({
                        ...d,
                        [tx._id]: { ...draft, categoryId },
                      }))
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

                <TagsInput
                  value={draft.tags}
                  onChange={(tags) =>
                    setDrafts((d) => ({
                      ...d,
                      [tx._id]: { ...draft, tags },
                    }))
                  }
                />

                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={saveMutation.isPending}
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
