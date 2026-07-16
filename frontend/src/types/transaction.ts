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
};

export type TransactionsListResponse = {
  items: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};
