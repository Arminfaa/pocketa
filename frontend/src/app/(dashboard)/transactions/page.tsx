"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Button,
  Card,
  Checkbox,
  Flex,
  Grid,
  Input,
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
} from "@ant-design/icons";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchAccounts } from "@/services/accounts";
import {
  createTransaction,
  deleteTransaction,
  fetchCategories,
  fetchTransactions,
  updateTransaction,
} from "@/services/transactions";
import type { Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { accountName, categoryName } from "@/lib/transaction-helpers";
import { exportTransactionsCsv } from "@/lib/export-transactions-csv";
import { useAppMessage } from "@/lib/antd-app";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionFormModal } from "@/features/transactions/TransactionFormModal";

const { useBreakpoint } = Grid;
const { Title, Text } = Typography;

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
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "",
    categoryId: "",
    tag: "",
    needsReviewOnly: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const limit = 20;

  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const categoriesQ = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const listKey = useMemo(
    () => ["transactions", selectedAccountId, page, filters, limit] as const,
    [selectedAccountId, page, filters, limit]
  );

  const listQ = useQuery({
    queryKey: listKey,
    queryFn: () =>
      fetchTransactions({
        page,
        limit,
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
    onSuccess: () => {
      message.success(editing ? "تراکنش به‌روزرسانی شد" : "تراکنش ثبت شد");
      setModalOpen(false);
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره تراکنش";
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

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const filteredCategories = (categoriesQ.data ?? []).filter((c) =>
    filters.type ? c.type === filters.type : true
  );

  function applySearch() {
    setPage(1);
    setFilters((f) => ({ ...f, search: searchInput.trim() }));
  }

  function clearFilters() {
    setSearchInput("");
    setPage(1);
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
        <Text
          strong
          type={tx.type === "income" ? "success" : "danger"}
          style={{ whiteSpace: "nowrap" }}
        >
          {tx.type === "income" ? "+" : "-"}
          {formatToman(amount)}
        </Text>
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
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Flex justify="space-between" align="flex-end" gap="middle" wrap="wrap">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            تراکنش‌ها
          </Title>
          <Text type="secondary">
            {selectedAccountId ? "فیلتر یک حساب از هدر فعال است" : "نمایش همه حساب‌ها"} · {total}{" "}
            مورد
          </Text>
        </div>
        <Space wrap>
          <Button icon={<DownloadOutlined />} onClick={() => void handleExport()}>
            خروجی CSV
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            تراکنش جدید
          </Button>
        </Space>
      </Flex>

      <Card size="small">
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Flex gap="small" wrap="wrap">
            <Input.Search
              style={{ flex: 1, minWidth: 200 }}
              placeholder="جستجو در عنوان یا توضیحات..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={applySearch}
              enterButton="جستجو"
            />
          </Flex>

          <Flex gap="small" wrap="wrap">
            <Select
              style={{ minWidth: 140, flex: 1 }}
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

            <Select
              style={{ minWidth: 140, flex: 1 }}
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

            <Input
              style={{ minWidth: 120, flex: 1 }}
              placeholder="فیلتر تگ"
              value={filters.tag}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, tag: e.target.value.trim() }));
              }}
            />

            <Checkbox
              checked={filters.needsReviewOnly}
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, needsReviewOnly: e.target.checked }));
              }}
            >
              فقط نیاز به بررسی
            </Checkbox>

            <Button onClick={clearFilters}>پاک کردن فیلترها</Button>
          </Flex>
        </Space>
      </Card>

      {listQ.isLoading ? <Skeleton className="h-64 w-full" /> : null}
      {listQ.error ? (
        <QueryError
          message="خطا در دریافت تراکنش‌ها."
          onRetry={() => void listQ.refetch()}
        />
      ) : null}

      {!listQ.isLoading && items.length === 0 ? (
        <EmptyState
          title="تراکنشی یافت نشد"
          description="یک تراکنش جدید اضافه کنید یا فیلترها را تغییر دهید."
        />
      ) : null}

      {isMobile && items.length > 0 ? (
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          {items.map((tx) => (
            <Card key={tx._id} size="small">
              <Flex justify="space-between" align="flex-start" gap="middle">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Space size={4} wrap>
                    <Text strong ellipsis>
                      {tx.title}
                    </Text>
                    {tx.needsReview ? (
                      <Tag icon={<ExclamationCircleOutlined />} color="warning">
                        بررسی
                      </Tag>
                    ) : null}
                  </Space>
                  {(tx.tags?.length ?? 0) > 0 ? (
                    <Flex gap={4} wrap="wrap" style={{ marginTop: 4 }}>
                      {tx.tags!.map((tag) => (
                        <Tag
                          key={tag}
                          color="cyan"
                          style={{ cursor: "pointer", margin: 0 }}
                          onClick={() => filterByTag(tag)}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </Flex>
                  ) : null}
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      {formatJalaliDate(tx.date)} · {categoryName(tx.categoryId)} ·{" "}
                      {accountName(tx.accountId)}
                    </Text>
                  </div>
                </div>
                <Text
                  strong
                  type={tx.type === "income" ? "success" : "danger"}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatToman(tx.amount)}
                </Text>
              </Flex>
              <Flex gap="small" style={{ marginTop: 12 }}>
                <Button block onClick={() => openEdit(tx)}>
                  ویرایش
                </Button>
                <Popconfirm
                  title="این تراکنش حذف شود؟"
                  okText="حذف"
                  cancelText="انصراف"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => deleteMutation.mutate(tx._id)}
                >
                  <Button block danger>
                    حذف
                  </Button>
                </Popconfirm>
              </Flex>
            </Card>
          ))}
        </Space>
      ) : null}

      {!isMobile && items.length > 0 ? (
        <Table<Transaction>
          rowKey="_id"
          columns={columns}
          dataSource={items}
          scroll={{ x: 900 }}
          pagination={false}
          size="middle"
        />
      ) : null}

      {totalPages > 1 ? (
        <Flex justify="center" align="center" gap="small">
          <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            قبلی
          </Button>
          <Text type="secondary">
            صفحه {page} از {totalPages}
          </Text>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            بعدی
          </Button>
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
    </Space>
  );
}
