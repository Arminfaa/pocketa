export type TransactionType = "income" | "expense";

export type TransactionCategoryRef = {
  _id: string;
  name: string;
  type: TransactionType;
  icon?: string;
  color?: string;
};

export type TransactionAccountRef = {
  _id: string;
  name: string;
  bankName?: string;
  color?: string;
  icon?: string;
};

export type Transaction = {
  _id: string;
  type: TransactionType;
  amount: number;
  title: string;
  description?: string;
  date: string;
  source?: "manual" | "bank_sms";
  needsReview?: boolean;
  tags?: string[];
  importHash?: string;
  bankMeta?: {
    bankName?: string;
    accountHint?: string;
    balanceAfter?: number;
    time?: string;
    rawSnippet?: string;
  };
  categoryId: TransactionCategoryRef | string;
  accountId: TransactionAccountRef | string;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionInput = {
  type: TransactionType;
  amount: number;
  categoryId: string;
  accountId: string;
  title: string;
  description?: string | null;
  date: string;
  needsReview?: boolean;
  tags?: string[];
  /** ثبت هم‌زمان به‌عنوان بدهی (درآمد) یا طلب (هزینه) */
  registerAsDebt?: boolean;
  /** تاریخ سررسید بدهی/طلب (جلالی) */
  debtDueDate?: string | null;
  /** تسویه سررسید موجود */
  settleRecurringId?: string | null;
  settleMode?: "full" | "partial" | null;
};

export type TransactionsListResponse = {
  items: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};
