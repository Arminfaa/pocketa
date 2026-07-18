"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  Flex,
  Grid,
  Input,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchAccounts } from "@/services/accounts";
import {
  bulkDeleteTransactions,
  createTransaction,
  createTransfer,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  updateTransaction,
} from "@/services/transactions";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { accountName, categoryName } from "@/lib/transaction-helpers";
import { exportTransactionsCsv } from "@/lib/export-transactions-csv";
import { useAppMessage } from "@/lib/antd-app";
import { TransactionsListSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { AmountText } from "@/components/ui/amount-text";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { SectionCard } from "@/components/ui/section-card";
import { SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { TransactionFormModal } from "@/features/transactions/TransactionFormModal";
import { TransferFormModal } from "@/features/transactions/TransferFormModal";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";

const { useBreakpoint } = Grid;
const { Text } = Typography;

const actionBtnClass = "!rounded-xl";
const headerActionBtnClass = "!h-11 !rounded-2xl !px-4";

type Filters = {
  search: string;
  type: "" | "income" | "expense";
  categoryId: string;
  tag: string;
  needsReviewOnly: boolean;
};

export default function TransactionsPage() {
  const { message } = useAppMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "",
    categoryId: "",
    tag: "",
    needsReviewOnly: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setEditing(null);
    setModalOpen(true);
    router.replace("/transactions", { scroll: false });
  }, [searchParams, router]);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
  });
  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const listKey = useMemo(
    () => ["transactions", selectedAccountId, page, pageSize, filters] as const,
    [selectedAccountId, page, pageSize, filters]
  );

  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchTransactions({
        page,
        limit: pageSize,
        search: filters.search || undefined,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        accountId: selectedAccountId,
        tag: filters.tag || undefined,
        needsReview: filters.needsReviewOnly ? true : undefined,
        sortBy: "date",
        sortOrder: "desc",
      }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createTransaction>[0]) => {
      if (editing) return updateTransaction(editing._id, payload);
      return createTransaction(payload);
    },
    onSuccess: (_data, variables) => {
      const asDebt = Boolean(variables.registerAsDebt);
      const asSettle = Boolean(variables.settleRecurringId);
      message.success(
        editing
          ? "تراکنش به‌روزرسانی شد"
          : asSettle
            ? "تراکنش ثبت و سررسید تسویه شد"
            : asDebt
              ? variables.type === "income"
                ? "تراکنش مثبت و بدهی یک‌باره ثبت شد"
                : "تراکنش منفی و طلب یک‌باره ثبت شد"
              : "تراکنش ثبت شد"
      );
      setModalOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      if (asDebt || asSettle) {
        void queryClient.invalidateQueries({ queryKey: ["recurring"] });
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره تراکنش";
      message.error(msg);
    },
  });

  const transferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      message.success("انتقال بین حساب‌ها ثبت شد");
      setTransferOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ثبت انتقال";
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["transactions"] });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old: unknown) => {
        if (!old || typeof old !== "object") return old;
        const data = old as { items: Transaction[]; pagination: { total: number } };
        return {
          ...data,
          items: data.items.filter((t) => t._id !== id),
          pagination: { ...data.pagination, total: Math.max(0, data.pagination.total - 1) },
        };
      });
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      return { previous };
    },
    onError: (err: unknown, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(listKey, ctx.previous);
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "حذف ناموفق بود";
      message.error(msg);
    },
    onSuccess: () => {
      message.success("تراکنش حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteTransactions(ids),
    onSuccess: (data) => {
      message.success(`${toPersianDigits(String(data.deletedCount))} تراکنش حذف شد`);
      setSelectedIds([]);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "حذف گروهی ناموفق بود";
      message.error(msg);
    },
  });

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.pagination.total ?? 0;
  const rowOffset = (page - 1) * pageSize;
  const pageIds = items.map((t) => t._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleSelectAllPage(checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) {
        const set = new Set(prev);
        for (const id of pageIds) set.add(id);
        return Array.from(set);
      }
      return prev.filter((id) => !pageIds.includes(id));
    });
  }

  const filteredCategories = (categoriesQ.data ?? []).filter((c) =>
    filters.type ? c.type === filters.type : true
  );

  function applySearch() {
    setPage(1);
    setSelectedIds([]);
    setFilters((f) => ({ ...f, search: searchInput.trim() }));
  }

  function clearFilters() {
    setSearchInput("");
    setPage(1);
    setSelectedIds([]);
    setFilters({ search: "", type: "", categoryId: "", tag: "", needsReviewOnly: false });
  }

  function filterByTag(tag: string) {
    setPage(1);
    setFilters((f) => ({ ...f, tag }));
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setModalOpen(true);
  }

  async function handleExport() {
    try {
      const all = await fetchTransactions({
        page: 1,
        limit: 100,
        search: filters.search || undefined,
        type: filters.type || undefined,
        categoryId: filters.categoryId || undefined,
        accountId: selectedAccountId,
        tag: filters.tag || undefined,
        needsReview: filters.needsReviewOnly ? true : undefined,
        sortBy: "date",
        sortOrder: "desc",
      });
      exportTransactionsCsv(all.items);
      message.success("خروجی CSV آماده شد");
    } catch {
      message.error("خروجی CSV ناموفق بود");
    }
  }

  const columns: TableColumnsType<Transaction> = [
    {
      title: "ردیف",
      key: "rowNumber",
      width: 64,
      align: "center",
      render: (_value, _record, index) => <Text type="secondary">{rowOffset + index + 1}</Text>,
    },
    {
      title: "تاریخ",
      dataIndex: "date",
      key: "date",
      width: 120,
      render: (date: string) => formatJalaliDate(date),
    },
    {
      title: "نوع",
      dataIndex: "type",
      key: "type",
      width: 90,
      render: (type: Transaction["type"]) => (
        <Text type={type === "income" ? "success" : "danger"}>
          {type === "income" ? "درآمد" : "هزینه"}
        </Text>
      ),
    },
    {
      title: "دسته‌بندی",
      key: "category",
      width: 140,
      render: (_, tx) => categoryName(tx.categoryId),
    },
    {
      title: "حساب",
      key: "account",
      width: 140,
      render: (_, tx) => accountName(tx.accountId),
    },
    {
      title: "عنوان",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (title: string, tx) => (
        <Space size={4} wrap>
          <span>{title}</span>
          {tx.needsReview ? (
            <Tag icon={<ExclamationCircleOutlined />} color="warning">
              بررسی
            </Tag>
          ) : null}
        </Space>
      ),
    },
    {
      title: "مبلغ",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      render: (amount: number, tx) => (
        <AmountText
          tone={tx.type === "income" ? "income" : "expense"}
          size="sm"
          prefix={tx.type === "income" ? "+" : "-"}
        >
          {formatToman(amount)}
        </AmountText>
      ),
    },
    {
      title: "عملیات",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, tx) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            className={actionBtnClass}
            icon={<EditOutlined />}
            aria-label="ویرایش"
            onClick={() => openEdit(tx)}
          />
          <Popconfirm
            title="این تراکنش حذف شود؟"
            okText="حذف"
            cancelText="انصراف"
            okButtonProps={{ danger: true }}
            onConfirm={() => deleteMutation.mutate(tx._id)}
          >
            <Button
              type="text"
              size="small"
              className={actionBtnClass}
              danger
              icon={<DeleteOutlined />}
              aria-label="حذف"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageShell width="full" gap="middle">
      <PageHeader
        title="تراکنش‌ها"
        description={
          <>
            {selectedAccountId ? "فیلتر یک حساب از هدر فعال است" : "نمایش همه حساب‌ها"} ·{" "}
            {toPersianDigits(String(total))} مورد
          </>
        }
        actions={
          <Space wrap>
            {selectedIds.length > 0 ? (
              <Popconfirm
                title={`${toPersianDigits(String(selectedIds.length))} تراکنش انتخاب‌شده حذف شود؟`}
                okText="حذف همه"
                cancelText="انصراف"
                okButtonProps={{ danger: true, loading: bulkDeleteMutation.isPending }}
                onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
              >
                <Button
                  danger
                  size="small"
                  className={actionBtnClass}
                  icon={<DeleteOutlined />}
                  loading={bulkDeleteMutation.isPending}
                >
                  حذف انتخاب‌شده‌ها ({toPersianDigits(String(selectedIds.length))})
                </Button>
              </Popconfirm>
            ) : null}
            <Button
              className={headerActionBtnClass}
              icon={<DownloadOutlined />}
              onClick={() => void handleExport()}
            >
              خروجی CSV
            </Button>
            <Button
              className={headerActionBtnClass}
              icon={<SwapOutlined />}
              onClick={() => setTransferOpen(true)}
            >
              انتقال بین حساب
            </Button>
            <Button
              type="primary"
              className={headerActionBtnClass}
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              تراکنش جدید
            </Button>
          </Space>
        }
      />

      <FilterBar>
        <FilterField label="جستجو" className="sm:min-w-[14rem] sm:flex-[2]">
          <Input.Search
            className="w-full"
            placeholder="جستجو در عنوان یا توضیحات..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={applySearch}
            enterButton="جستجو"
          />
        </FilterField>

        <FilterField label="نوع" className="sm:max-w-[10rem]">
          <Select
            className="w-full"
            value={filters.type}
            onChange={(value) => {
              setPage(1);
              setFilters((f) => ({
                ...f,
                type: value as Filters["type"],
                categoryId: "",
              }));
            }}
            options={[
              { value: "", label: "همه انواع" },
              { value: "income", label: "درآمد" },
              { value: "expense", label: "هزینه" },
            ]}
          />
        </FilterField>

        <FilterField label="دسته" className="sm:max-w-[12rem]">
          <Select
            className="w-full"
            value={filters.categoryId || undefined}
            placeholder="همه دسته‌ها"
            allowClear
            onChange={(value) => {
              setPage(1);
              setFilters((f) => ({ ...f, categoryId: value ?? "" }));
            }}
            options={filteredCategories.map((c) => ({
              value: c._id,
              label: c.name,
            }))}
          />
        </FilterField>

        <FilterField label="تگ" className="sm:max-w-[10rem]">
          <Input
            className="w-full"
            placeholder="فیلتر تگ"
            value={filters.tag}
            onChange={(e) => {
              setPage(1);
              setFilters((f) => ({ ...f, tag: e.target.value.trim() }));
            }}
          />
        </FilterField>

        <FilterField className="sm:min-w-[12rem]">
          <Flex gap="small" wrap="wrap" align="center" className="h-full pt-1 sm:pt-5">
            <Checkbox
              checked={filters.needsReviewOnly}
              className="!items-center"
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, needsReviewOnly: e.target.checked }));
              }}
            >
              فقط نیاز به بررسی
            </Checkbox>
            <Button size="small" className={actionBtnClass} onClick={clearFilters}>
              پاک کردن فیلترها
            </Button>
          </Flex>
        </FilterField>
      </FilterBar>

      {listQ.isLoading ? <TransactionsListSkeleton /> : null}
      {listQ.error ? (
        <QueryError message="خطا در دریافت تراکنش‌ها." onRetry={() => void listQ.refetch()} />
      ) : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="تراکنشی یافت نشد"
          description="یک تراکنش جدید اضافه کنید یا فیلترها را تغییر دهید."
        />
      ) : null}

      {isMobile && items.length > 0 ? (
        <SoftList
          header={
            <Flex align="center" gap="small">
              <Checkbox
                checked={allPageSelected}
                indeterminate={somePageSelected && !allPageSelected}
                onChange={(e) => toggleSelectAllPage(e.target.checked)}
              >
                <Text type="secondary" className="text-xs">
                  انتخاب همه در این صفحه ({toPersianDigits(String(items.length))})
                </Text>
              </Checkbox>
            </Flex>
          }
        >
          {items.map((tx, index) => (
            <SoftListItem key={tx._id}>
              <SoftListRow
                leading={
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(tx._id)}
                    onChange={(e) => toggleSelect(tx._id, e.target.checked)}
                  />
                }
                title={
                  <Space size={4} wrap>
                    <Text type="secondary" className="tabular-nums text-xs">
                      #{rowOffset + index + 1}
                    </Text>
                    <span>{tx.title}</span>
                    {tx.needsReview ? (
                      <Tag icon={<ExclamationCircleOutlined />} color="warning">
                        بررسی
                      </Tag>
                    ) : null}
                  </Space>
                }
                subtitle={
                  <>
                    {(tx.tags?.length ?? 0) > 0 ? (
                      <Flex gap={4} wrap="wrap" className="mb-1">
                        {tx.tags!.map((tag) => (
                          <Tag
                            key={tag}
                            color="blue"
                            className="cursor-pointer !m-0"
                            onClick={() => filterByTag(tag)}
                          >
                            {tag}
                          </Tag>
                        ))}
                      </Flex>
                    ) : null}
                    <span>
                      {formatJalaliDate(tx.date)} · {categoryName(tx.categoryId)} ·{" "}
                      {accountName(tx.accountId)}
                    </span>
                  </>
                }
                trailing={
                  <AmountText
                    tone={tx.type === "income" ? "income" : "expense"}
                    size="sm"
                    prefix={tx.type === "income" ? "+" : "-"}
                    caption={tx.type === "income" ? "دریافتی" : "پرداختی"}
                  >
                    {formatToman(tx.amount)}
                  </AmountText>
                }
                footer={
                  <Flex gap="small">
                    <Button
                      size="small"
                      className={actionBtnClass}
                      icon={<EditOutlined />}
                      onClick={() => openEdit(tx)}
                    >
                      ویرایش
                    </Button>
                    <Popconfirm
                      title="این تراکنش حذف شود؟"
                      okText="حذف"
                      cancelText="انصراف"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => deleteMutation.mutate(tx._id)}
                    >
                      <Button size="small" className={actionBtnClass} danger icon={<DeleteOutlined />}>
                        حذف
                      </Button>
                    </Popconfirm>
                  </Flex>
                }
              />
            </SoftListItem>
          ))}
        </SoftList>
      ) : null}

      {!isMobile && items.length > 0 ? (
        <SectionCard
          title="لیست تراکنش‌ها"
          extra={
            <Text type="secondary" className="text-xs">
              {toPersianDigits(String(total))} مورد
            </Text>
          }
          flush
          bodyClassName="!p-0"
        >
          <Table<Transaction>
            rowKey="_id"
            columns={columns}
            dataSource={items}
            scroll={{ x: 960 }}
            pagination={false}
            size="middle"
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys.map(String)),
            }}
          />
        </SectionCard>
      ) : null}

      {total > 0 ? (
        <Flex justify="center" className="w-full py-1">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            showTotal={(t, range) => `${range[0]}–${range[1]} از ${t}`}
            onChange={(nextPage, nextSize) => {
              if (nextSize !== pageSize) {
                setPageSize(nextSize);
                setPage(1);
                setSelectedIds([]);
                return;
              }
              setPage(nextPage);
            }}
          />
        </Flex>
      ) : null}

      <TransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        accounts={accountsQ.data ?? []}
        categories={categoriesQ.data ?? []}
        initial={editing}
        defaultAccountId={selectedAccountId ?? accountsQ.data?.[0]?.id ?? null}
        submitting={saveMutation.isPending}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
      />

      <TransferFormModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={accountsQ.data ?? []}
        defaultFromAccountId={selectedAccountId ?? accountsQ.data?.[0]?.id ?? null}
        submitting={transferMutation.isPending}
        onSubmit={async (values) => {
          await transferMutation.mutateAsync(values);
        }}
      />
    </PageShell>
  );
}
