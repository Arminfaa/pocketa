import mongoose from "mongoose";
import { BankAccountModel } from "../models/BankAccount";
import { BankImportModel } from "../models/BankImport";
import { BudgetModel } from "../models/Budget";
import { CategoryModel } from "../models/Category";
import { InvestmentModel } from "../models/Investment";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { SavingsGoalModel } from "../models/SavingsGoal";
import { TransactionModel } from "../models/Transaction";
import { UserModel } from "../models/User";
import type { BackupPayload } from "../validations/backup";

const BACKUP_VERSION = 1 as const;

type BackupDoc = BackupPayload["accounts"][number];

/** JSON-safe clone: ObjectIds → strings, Dates → ISO */
function toPlain(docs: unknown[]): BackupDoc[] {
  return JSON.parse(JSON.stringify(docs)) as BackupDoc[];
}

function withUserId(docs: BackupDoc[], userId: string): BackupDoc[] {
  return docs.map((doc) => {
    const { __v: _ignored, ...rest } = doc as BackupDoc & { __v?: unknown };
    return { ...rest, userId } as BackupDoc;
  });
}

export async function buildUserBackup(userId: string): Promise<BackupPayload> {
  const userOid = new mongoose.Types.ObjectId(userId);
  const filter = { userId: userOid };

  const [user, accounts, categories, goals, investments, recurring, transactions, budgets, bankImports] =
    await Promise.all([
      UserModel.findById(userOid).select("name email").lean(),
      BankAccountModel.find(filter).lean(),
      CategoryModel.find(filter).lean(),
      SavingsGoalModel.find(filter).lean(),
      InvestmentModel.find(filter).lean(),
      RecurringTransactionModel.find(filter).lean(),
      TransactionModel.find(filter).lean(),
      BudgetModel.find(filter).lean(),
      BankImportModel.find(filter).lean(),
    ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: user
      ? { name: user.name, email: user.email }
      : undefined,
    accounts: toPlain(accounts),
    categories: toPlain(categories),
    goals: toPlain(goals),
    investments: toPlain(investments),
    recurring: toPlain(recurring),
    transactions: toPlain(transactions),
    budgets: toPlain(budgets),
    bankImports: toPlain(bankImports),
  };
}

export type RestoreSummary = {
  accounts: number;
  categories: number;
  goals: number;
  investments: number;
  recurring: number;
  transactions: number;
  budgets: number;
  bankImports: number;
};

/**
 * Replace-all restore for the authenticated user.
 * Preserves document `_id`s so cross-links (transfers, debts, goals, …) stay valid.
 * Does not change password or email; optionally updates display name from backup.
 */
export async function restoreUserBackup(
  userId: string,
  backup: BackupPayload
): Promise<RestoreSummary> {
  const userOid = new mongoose.Types.ObjectId(userId);
  const filter = { userId: userOid };

  // Wipe in reverse dependency order
  await TransactionModel.deleteMany(filter);
  await BudgetModel.deleteMany(filter);
  await BankImportModel.deleteMany(filter);
  await RecurringTransactionModel.deleteMany(filter);
  await InvestmentModel.deleteMany(filter);
  await SavingsGoalModel.deleteMany(filter);
  await CategoryModel.deleteMany(filter);
  await BankAccountModel.deleteMany(filter);

  const accounts = withUserId(backup.accounts, userId);
  const categories = withUserId(backup.categories, userId);
  const goals = withUserId(backup.goals, userId);
  const investments = withUserId(backup.investments, userId);
  const recurring = withUserId(backup.recurring, userId);
  const transactions = withUserId(backup.transactions, userId);
  const budgets = withUserId(backup.budgets, userId);
  const bankImports = withUserId(backup.bankImports ?? [], userId);

  // Insert parents before children; investments ↔ recurring may cross-link — both after goals
  if (accounts.length) await BankAccountModel.insertMany(accounts, { ordered: true });
  if (categories.length) await CategoryModel.insertMany(categories, { ordered: true });
  if (goals.length) await SavingsGoalModel.insertMany(goals, { ordered: true });
  if (investments.length) await InvestmentModel.insertMany(investments, { ordered: true });
  if (recurring.length) await RecurringTransactionModel.insertMany(recurring, { ordered: true });
  if (transactions.length) await TransactionModel.insertMany(transactions, { ordered: true });
  if (budgets.length) await BudgetModel.insertMany(budgets, { ordered: true });
  if (bankImports.length) await BankImportModel.insertMany(bankImports, { ordered: true });

  const backupName = backup.user?.name?.trim();
  if (backupName && backupName.length >= 2) {
    await UserModel.findByIdAndUpdate(userOid, { $set: { name: backupName } });
  }

  return {
    accounts: accounts.length,
    categories: categories.length,
    goals: goals.length,
    investments: investments.length,
    recurring: recurring.length,
    transactions: transactions.length,
    budgets: budgets.length,
    bankImports: bankImports.length,
  };
}
