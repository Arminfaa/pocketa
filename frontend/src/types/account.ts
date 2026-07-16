export type BankAccount = {
  id: string;
  name: string;
  bankName: string;
  color: string;
  icon: string;
  initialBalance: number;
  isActive: boolean;
  balance: number;
  transactionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};
