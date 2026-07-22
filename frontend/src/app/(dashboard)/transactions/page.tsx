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
  SearchOutlined,
  SwapOutlined,
  CloudUploadOutlined,
} from "@ant-design/icons";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { useAuthStore } from "@/stores/auth.store";
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
import type { PendingSyncMeta, Transaction } from "@/types/transaction";
import { formatJalaliDate, formatToman, toPersianDigits } from "@/lib/format";
import { formatTransactionDateTime, transactionTimeOf } from "@/lib/transaction-time";
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
import { cn } from "@/lib/cn";
import { useOfflineOutbox } from "@/hooks/use-offline-outbox";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { captureTransaction } from "@/lib/offline/capture";
import { outboxToPendingTransaction, isPendingTransactionId } from "@/lib/offline/pending-tx";
import { removeOutboxItem } from "@/lib/offline/outbox";
import { syncOutbox } from "@/lib/offline/sync";

type ListTransaction = Transaction & PendingSyncMeta;

function isTransferTx(tx: Pick<Transaction, "source">): boolean {
  return tx.source === "transfer";
}

/** Type column / caption: transfers show as انتقال (+/−), not درآمد/هزینه */
function transactionTypeLabel(tx: Pick<Transaction, "type" | "source">): {
  text: string;
  tone: "success" | "danger" | "secondary";
} {
  if (isTransferTx(tx)) {
    return tx.type === "income"
      ? { text: "انتقال +", tone: "success" }
      : { text: "انتقال −", tone: "danger" };
  }
  return tx.type === "income"
    ? { text: "درآمد", tone: "success" }
    : { text: "هزینه", tone: "danger" };
}

function transactionAmountCaption(tx: Pick<Transaction, "type" | "source">): string {
  if (isTransferTx(tx)) {
    return tx.type === "income" ? "ورود" : "خروج";
  }
  return tx.type === "income" ? "دریافتی" : "پرداختی";
}

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
  transfersOnly: boolean;
};

export default function TransactionsPage() {
  const { message } = useAppMessage();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const online = useOnlineStatus();
  const { items: outboxItems } = useOfflineOutbox();
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
    transfersOnly: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapAccounts, setSnapAccounts] = useState<Awaited<ReturnType<typeof fetchAccounts>>>([]);
  const [snapCategories, setSnapCategories] = useState<
    Awaited<ReturnType<typeof fetchCategories>>
  >([]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditing(null);
      setModalOpen(true);
      router.replace("/transactions", { scroll: false });
      return;
    }
    if (searchParams.get("transfer") === "1") {
      if (!navigator.onLine) {
        message.warning("انتقال بین حساب فقط با اینترنت ممکن است");
        router.replace("/transactions", { scroll: false });
        return;
      }
      setTransferOpen(true);
      router.replace("/transactions", { scroll: false });
    }
  }, [searchParams, router, message]);

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

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { getAccountsSnapshot, getCategoriesSnapshot } = await import(
        "@/lib/offline/snapshots"
      );
      const [a, c] = await Promise.all([
        getAccountsSnapshot(userId),
        getCategoriesSnapshot(userId),
      ]);
      setSnapAccounts(a);
      setSnapCategories(c);
    })();
  }, [userId, accountsQ.data, categoriesQ.data]);

  const formAccounts = useMemo(() => {
    const live = accountsQ.data;
    if (live && live.length > 0) return live;
    return snapAccounts;
  }, [accountsQ.data, snapAccounts]);

  const formCategories = useMemo(() => {
    const live = categoriesQ.data;
    if (live && live.length > 0) return live;
    return snapCategories;
  }, [categoriesQ.data, snapCategories]);

  const listKey = useMemo(
    () => ["transactions", selectedAccountId, page, pageSize, filters] as const,
    [selectedAccountId, page, pageSize, filters]
  );

  const pendingTxs = useMemo(() => {
    if (filters.needsReviewOnly || filters.transfersOnly) return [] as ListTransaction[];
    const q = filters.search.trim().toLowerCase();
    return outboxItems
      .map(outboxToPendingTransaction)
      .filter((tx) => {
        if (selectedAccountId) {
          const accId =
            typeof tx.accountId === "string" ? tx.accountId : tx.accountId._id;
          if (accId !== selectedAccountId) return false;
        }
        if (filters.type && tx.type !== filters.type) return false;
        if (filters.categoryId) {
          const catId =
            typeof tx.categoryId === "string" ? tx.categoryId : tx.categoryId._id;
          if (catId !== filters.categoryId) return false;
        }
        if (filters.tag && !(tx.tags ?? []).includes(filters.tag)) return false;
        if (q) {
          const hay = `${tx.title} ${tx.description ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }) as ListTransaction[];
  }, [outboxItems, filters, selectedAccountId]);

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
        source: filters.transfersOnly ? "transfer" : undefined,
        sortBy: "date",
        sortOrder: "desc",
      }),
    retry: online ? 1 : 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof captureTransaction>[0]["payload"]) => {
      if (editing) {
        if (!online) throw new Error("برای ویرایش به اینترنت نیاز است");
        return updateTransaction(editing._id, payload);
      }

      const complex =
        Boolean(payload.registerAsDebt) || Boolean(payload.settleRecurringId);
      if (complex && !online) {
        throw new Error("ثبت بدهی/طلب و تسویه فقط با اینترنت ممکن است");
      }
      if (complex) {
        return createTransaction(payload);
      }

      if (!userId) throw new Error("برای ثبت باید وارد شوید");

      const account = formAccounts.find((a) => a.id === payload.accountId);
      const category = formCategories.find((c) => c._id === payload.categoryId);
      const result = await captureTransaction({
        userId,
        payload,
        accountName: account?.name,
        categoryName: category?.name,
        preferQueue: !online,
      });
      return result;
    },
    onSuccess: (data, variables) => {
      const asDebt = Boolean(variables.registerAsDebt);
      const asSettle = Boolean(variables.settleRecurringId);
      const queued =
        data &&
        typeof data === "object" &&
        "mode" in data &&
        (data as { mode: string }).mode === "queued";

      message.success(
        editing
          ? "تراکنش به‌روزرسانی شد"
          : queued
            ? online
              ? "در صف ارسال قرار گرفت"
              : "آفلاین ذخیره شد — بعد از اتصال ارسال می‌شود"
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
        (err as { response?: { data?: { message?: string } }; message?: string })?.response
          ?.data?.message ??
        (err as { message?: string })?.message ??
        "خطا در ذخیره تراکنش";
      message.error(msg);
    },
  });

  const transferMutation = useMutation({
    mutationFn: createTransfer,
    onSuccess: () => {
      message.success("انتقال ثبت شد: یک تراکنش منفی (−) و یک مثبت (+)");
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
    mutationFn: async (id: string) => {
      if (isPendingTransactionId(id)) {
        const clientId = id.replace(/^pending:/, "");
        await removeOutboxItem(clientId);
        return;
      }
      await deleteTransaction(id);
    },
    onMutate: async (id) => {
      if (isPendingTransactionId(id)) {
        setSelectedIds((ids) => ids.filter((x) => x !== id));
        return { previous: undefined };
      }
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
    onSuccess: (_data, id) => {
      message.success(isPendingTransactionId(id) ? "از صف حذف شد" : "تراکنش حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const pendingIds = ids.filter(isPendingTransactionId);
      const serverIds = ids.filter((id) => !isPendingTransactionId(id));
      for (const id of pendingIds) {
        await removeOutboxItem(id.replace(/^pending:/, ""));
      }
      if (serverIds.length === 0) {
        return { deletedCount: pendingIds.length };
      }
      const result = await bulkDeleteTransactions(serverIds);
      return { deletedCount: result.deletedCount + pendingIds.length };
    },
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

  const serverItems = listQ.data?.items ?? [];
  const items: ListTransaction[] =
    page === 1 ? [...pendingTxs, ...serverItems] : serverItems;
  const total = (listQ.data?.pagination.total ?? 0) + pendingTxs.length;
  const rowOffset = (page - 1) * pageSize;
  const pageIds = items
    .filter((t) => !isPendingTransactionId(t._id))
    .map((t) => t._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const somePageSelected = pageIds.some((id) => selectedIds.includes(id));

  function toggleSelect(id: string, checked: boolean) {
    if (isPendingTransactionId(id)) return;
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

  /** Clear input + applied search filter (× on the field). */
  function clearSearch() {
    setSearchInput("");
    setPage(1);
    setSelectedIds([]);
    setFilters((f) => ({ ...f, search: "" }));
  }

  function clearFilters() {
    setSearchInput("");
    setPage(1);
    setSelectedIds([]);
    setFilters({
      search: "",
      type: "",
      categoryId: "",
      tag: "",
      needsReviewOnly: false,
      transfersOnly: false,
    });
  }

  function filterByTag(tag: string) {
    setPage(1);
    setFilters((f) => ({ ...f, tag }));
  }

  function openEdit(tx: ListTransaction) {
    if (isPendingTransactionId(tx._id)) {
      message.info("این تراکنش هنوز همگام نشده و قابل ویرایش نیست");
      return;
    }
    if (!online) {
      message.warning("برای ویرایش به اینترنت نیاز است");
      return;
    }
    setEditing(tx);
    setModalOpen(true);
  }

  async function retryPendingSync() {
    if (!userId || !online) return;
    const result = await syncOutbox(userId);
    if (result.synced > 0) {
      message.success(`${toPersianDigits(String(result.synced))} تراکنش همگام‌سازی شد`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    } else if (result.failed > 0) {
      message.error("برخی تراکنش‌ها همگام‌سازی نشدند");
    }
  }

  function syncStatusTag(tx: ListTransaction) {
    if (!tx.syncStatus) return null;
    if (tx.syncStatus === "failed") {
      return (
        <Tag color="error" className="!m-0">
          خطا در ارسال
        </Tag>
      );
    }
    if (tx.syncStatus === "syncing") {
      return (
        <Tag color="processing" className="!m-0">
          در حال ارسال
        </Tag>
      );
    }
    return (
      <Tag icon={<CloudUploadOutlined />} color="default" className="!m-0">
        در صف
      </Tag>
    );
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
        source: filters.transfersOnly ? "transfer" : undefined,
        sortBy: "date",
        sortOrder: "desc",
      });
      exportTransactionsCsv(all.items);
      message.success("خروجی CSV آماده شد");
    } catch {
      message.error("خروجی CSV ناموفق بود");
    }
  }

  const columns: TableColumnsType<ListTransaction> = [
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
      width: 150,
      render: (date: string, tx) =>
        formatTransactionDateTime(formatJalaliDate(date), transactionTimeOf(tx) || undefined),
    },
    {
      title: "نوع",
      dataIndex: "type",
      key: "type",
      width: 110,
      render: (_type: Transaction["type"], tx) => {
        const label = transactionTypeLabel(tx);
        return <Text type={label.tone}>{label.text}</Text>;
      },
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
      render: (title: string, tx: ListTransaction) => (
        <Space size={4} wrap>
          <span>{title}</span>
          {syncStatusTag(tx)}
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
      width: 120,
      fixed: "right",
      render: (_, tx: ListTransaction) => (
        <Space size={4}>
          {tx.syncStatus === "failed" && online ? (
            <Button
              type="text"
              size="small"
              className={actionBtnClass}
              icon={<CloudUploadOutlined />}
              aria-label="تلاش مجدد"
              onClick={() => void retryPendingSync()}
            />
          ) : null}
          {!isPendingTransactionId(tx._id) ? (
            <Button
              type="text"
              size="small"
              className={actionBtnClass}
              icon={<EditOutlined />}
              aria-label="ویرایش"
              onClick={() => openEdit(tx)}
            />
          ) : null}
          <Popconfirm
            title={
              isPendingTransactionId(tx._id)
                ? "از صف حذف شود؟"
                : "این تراکنش حذف شود؟"
            }
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
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
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
                  block={isMobile}
                  className={actionBtnClass}
                  icon={<DeleteOutlined />}
                  loading={bulkDeleteMutation.isPending}
                >
                  حذف انتخاب‌شده‌ها ({toPersianDigits(String(selectedIds.length))})
                </Button>
              </Popconfirm>
            ) : null}
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <Button
                className={cn(headerActionBtnClass, "min-w-0 !px-2.5 sm:!px-4")}
                icon={<DownloadOutlined />}
                onClick={() => void handleExport()}
                disabled={!online}
              >
                {isMobile ? "خروجی" : "خروجی CSV"}
              </Button>
              <Button
                className={cn(headerActionBtnClass, "min-w-0 !px-2.5 sm:!px-4")}
                icon={<SwapOutlined />}
                disabled={!online}
                onClick={() => setTransferOpen(true)}
              >
                انتقال بین حساب
              </Button>
            </div>
            <Button
              type="primary"
              block={isMobile}
              className={headerActionBtnClass}
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              تراکنش جدید
            </Button>
          </div>
        }
      />

      <FilterBar>
        <FilterField label="جستجو" className="sm:min-w-[12rem] sm:flex-[1.5]">
          <div className="flex w-full min-w-0 items-stretch gap-1.5">
            <Input
              className="min-w-0 flex-1"
              prefix={<SearchOutlined className="text-app-muted" />}
              placeholder="عنوان یا توضیحات..."
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                // × / emptying the field should also clear the applied query
                if (!value.trim() && filters.search) {
                  setPage(1);
                  setSelectedIds([]);
                  setFilters((f) => ({ ...f, search: "" }));
                }
              }}
              onClear={clearSearch}
              onPressEnter={applySearch}
              allowClear
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              aria-label="جستجو"
              onClick={applySearch}
              className="!shrink-0"
            />
          </div>
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
            <Checkbox
              checked={filters.transfersOnly}
              className="!items-center"
              onChange={(e) => {
                setPage(1);
                setFilters((f) => ({ ...f, transfersOnly: e.target.checked }));
              }}
            >
              فقط انتقال بین حساب
            </Checkbox>
            <Button size="small" className={actionBtnClass} onClick={clearFilters}>
              پاک کردن فیلترها
            </Button>
          </Flex>
        </FilterField>
      </FilterBar>

      {listQ.isLoading && items.length === 0 ? <TransactionsListSkeleton /> : null}
      {listQ.error && items.length === 0 ? (
        <QueryError message="خطا در دریافت تراکنش‌ها." onRetry={() => void listQ.refetch()} />
      ) : null}
      {listQ.error && pendingTxs.length > 0 ? (
        <Text type="secondary" className="text-xs">
          لیست سرور در دسترس نیست — موارد در صف محلی نمایش داده می‌شود.
          {online ? (
            <>
              {" "}
              <button
                type="button"
                className="text-brand-600 underline dark:text-brand-300"
                onClick={() => void listQ.refetch()}
              >
                تلاش مجدد
              </button>
            </>
          ) : null}
        </Text>
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
                  isPendingTransactionId(tx._id) ? (
                    <span className="mt-1 inline-block w-4" />
                  ) : (
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.includes(tx._id)}
                      onChange={(e) => toggleSelect(tx._id, e.target.checked)}
                    />
                  )
                }
                title={
                  <Space size={4} wrap>
                    <Text type="secondary" className="tabular-nums text-xs">
                      #{rowOffset + index + 1}
                    </Text>
                    <span>{tx.title}</span>
                    {syncStatusTag(tx)}
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
                      {formatTransactionDateTime(
                        formatJalaliDate(tx.date),
                        transactionTimeOf(tx) || undefined
                      )}{" "}
                      · {isTransferTx(tx) ? transactionTypeLabel(tx).text : categoryName(tx.categoryId)}{" "}
                      · {accountName(tx.accountId)}
                    </span>
                  </>
                }
                trailing={
                  <AmountText
                    tone={tx.type === "income" ? "income" : "expense"}
                    size="sm"
                    prefix={tx.type === "income" ? "+" : "-"}
                    caption={transactionAmountCaption(tx)}
                  >
                    {formatToman(tx.amount)}
                  </AmountText>
                }
                footer={
                  <Flex gap="small" wrap="wrap">
                    {tx.syncStatus === "failed" && online ? (
                      <Button
                        size="small"
                        className={actionBtnClass}
                        icon={<CloudUploadOutlined />}
                        onClick={() => void retryPendingSync()}
                      >
                        تلاش مجدد
                      </Button>
                    ) : null}
                    {!isPendingTransactionId(tx._id) ? (
                      <Button
                        size="small"
                        className={actionBtnClass}
                        icon={<EditOutlined />}
                        onClick={() => openEdit(tx)}
                      >
                        ویرایش
                      </Button>
                    ) : null}
                    <Popconfirm
                      title={
                        isPendingTransactionId(tx._id)
                          ? "از صف حذف شود؟"
                          : "این تراکنش حذف شود؟"
                      }
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
          <Table<ListTransaction>
            rowKey="_id"
            columns={columns}
            dataSource={items}
            scroll={{ x: 960 }}
            pagination={false}
            size="middle"
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) =>
                setSelectedIds(keys.map(String).filter((id) => !isPendingTransactionId(id))),
              getCheckboxProps: (record) => ({
                disabled: isPendingTransactionId(record._id),
              }),
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
        accounts={formAccounts}
        categories={formCategories}
        initial={editing}
        defaultAccountId={null}
        submitting={saveMutation.isPending}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
        }}
      />

      <TransferFormModal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        accounts={formAccounts}
        defaultFromAccountId={selectedAccountId ?? formAccounts[0]?.id ?? null}
        submitting={transferMutation.isPending}
        onSubmit={async (values) => {
          await transferMutation.mutateAsync(values);
        }}
      />
    </PageShell>
  );
}
