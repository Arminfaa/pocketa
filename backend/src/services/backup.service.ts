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
import { AppError } from "../utils/AppError";
import type { BackupPayload } from "../validations/backup";

const BACKUP_VERSION = 1 as const;

type BackupDoc = BackupPayload["accounts"][number];

const OBJECT_ID_HEX = /^[a-fA-F0-9]{24}$/;

/** ObjectId-like fields where empty string / null must be omitted (not cast). */
const OBJECT_ID_KEYS = new Set([
  "_id",
  "userId",
  "accountId",
  "categoryId",
  "transferGroupId",
  "linkedTransactionId",
  "settledRecurringId",
  "createdDebtId",
  "deferredDebtId",
  "investmentId",
  "goalId",
  "recurringId",
]);

/** Refs remapped to new ids so restore works on a different account (no _id collisions). */
const REMAP_KEYS = new Set([
  "_id",
  "accountId",
  "categoryId",
  "transferGroupId",
  "linkedTransactionId",
  "settledRecurringId",
  "createdDebtId",
  "deferredDebtId",
  "investmentId",
  "goalId",
  "recurringId",
]);

const SETTLE_SNAPSHOT_ID_KEYS = ["recurringId", "deferredDebtId"] as const;

/**
 * Drop null/undefined (and empty strings on ObjectId fields) so Mongoose enum/cast
 * validation does not reject restored lean JSON dumps.
 */
function deepSanitize(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value === "" && key && OBJECT_ID_KEYS.has(key)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => deepSanitize(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const proto = Object.prototype.toString.call(value);
    if (proto !== "[object Object]") return value;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "__v") continue;
      const next = deepSanitize(v, k);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return value;
}

/** JSON-safe clone: ObjectIds → strings, Dates → ISO; strip nulls for clean backups */
function toPlain(docs: unknown[]): BackupDoc[] {
  const cloned = JSON.parse(JSON.stringify(docs)) as unknown[];
  return cloned.map((doc) => deepSanitize(doc) as BackupDoc);
}

function sanitizeDocs(docs: BackupDoc[]): Record<string, unknown>[] {
  return docs.map((doc) => deepSanitize(doc) as Record<string, unknown>);
}

function collectId(value: unknown, into: Set<string>) {
  if (typeof value === "string" && OBJECT_ID_HEX.test(value)) {
    into.add(value);
  }
}

function collectIdsFromDoc(doc: Record<string, unknown>, into: Set<string>) {
  for (const [key, value] of Object.entries(doc)) {
    if (key === "userId") continue;
    if (REMAP_KEYS.has(key)) {
      collectId(value, into);
      continue;
    }
    if (key === "settleSnapshot" && value && typeof value === "object" && !Array.isArray(value)) {
      const snap = value as Record<string, unknown>;
      for (const sk of SETTLE_SNAPSHOT_ID_KEYS) {
        collectId(snap[sk], into);
      }
    }
  }
}

function buildIdMap(ids: Set<string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const id of ids) {
    map.set(id, new mongoose.Types.ObjectId().toString());
  }
  return map;
}

function remapId(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string" && idMap.has(value)) return idMap.get(value);
  return value;
}

/**
 * Rewrite every document `_id` and FK to fresh ObjectIds, then attach the current userId.
 * Required for restoring a backup onto a different account without colliding with the source.
 */
function remapDoc(
  doc: Record<string, unknown>,
  idMap: Map<string, string>,
  userId: string
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === "userId") {
      out.userId = userId;
      continue;
    }
    if (key === "settleSnapshot" && value && typeof value === "object" && !Array.isArray(value)) {
      const snap: Record<string, unknown> = { ...(value as Record<string, unknown>) };
      for (const sk of SETTLE_SNAPSHOT_ID_KEYS) {
        if (sk in snap) snap[sk] = remapId(snap[sk], idMap);
      }
      out[key] = snap;
      continue;
    }
    if (REMAP_KEYS.has(key)) {
      out[key] = remapId(value, idMap);
      continue;
    }
    out[key] = value;
  }
  out.userId = userId;
  return out;
}

function prepareCollectionsForRestore(
  backup: BackupPayload,
  userId: string
): {
  accounts: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  investments: Record<string, unknown>[];
  recurring: Record<string, unknown>[];
  transactions: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  bankImports: Record<string, unknown>[];
} {
  const accounts = sanitizeDocs(backup.accounts);
  const categories = sanitizeDocs(backup.categories);
  const goals = sanitizeDocs(backup.goals);
  const investments = sanitizeDocs(backup.investments);
  const recurring = sanitizeDocs(backup.recurring);
  const transactions = sanitizeDocs(backup.transactions);
  const budgets = sanitizeDocs(backup.budgets);
  const bankImports = sanitizeDocs(backup.bankImports ?? []);

  const allIds = new Set<string>();
  for (const docs of [
    accounts,
    categories,
    goals,
    investments,
    recurring,
    transactions,
    budgets,
    bankImports,
  ]) {
    for (const doc of docs) collectIdsFromDoc(doc, allIds);
  }

  const idMap = buildIdMap(allIds);

  return {
    accounts: accounts.map((d) => remapDoc(d, idMap, userId)),
    categories: categories.map((d) => remapDoc(d, idMap, userId)),
    goals: goals.map((d) => remapDoc(d, idMap, userId)),
    investments: investments.map((d) => remapDoc(d, idMap, userId)),
    recurring: recurring.map((d) => remapDoc(d, idMap, userId)),
    transactions: transactions.map((d) => remapDoc(d, idMap, userId)),
    budgets: budgets.map((d) => remapDoc(d, idMap, userId)),
    bankImports: bankImports.map((d) => remapDoc(d, idMap, userId)),
  };
}

function restoreFailureMessage(err: unknown, stage: string): string {
  if (err && typeof err === "object") {
    const name = "name" in err ? String(err.name) : "";
    if (name === "ValidationError" && "message" in err) {
      return `خطا در اعتبارسنجی بکاپ (${stage}): ${String((err as { message: string }).message)}`;
    }
    if (name === "CastError") {
      const path = "path" in err ? String((err as { path: string }).path) : "";
      return path
        ? `مقدار نامعتبر در بکاپ (${stage} / ${path})`
        : `مقدار نامعتبر در بکاپ (${stage})`;
    }
    if ("code" in err && (err as { code: number }).code === 11000) {
      return `تداخل شناسه هنگام بازیابی (${stage})`;
    }
    if ("message" in err && typeof (err as { message: unknown }).message === "string") {
      return `بازیابی ناموفق (${stage}): ${(err as { message: string }).message}`;
    }
  }
  return `بازیابی ناموفق بود (${stage})`;
}

async function insertPrepared(
  model: { insertMany: (docs: unknown[], opts: { ordered: boolean }) => Promise<unknown> },
  docs: Record<string, unknown>[],
  stage: string
) {
  if (!docs.length) return;
  try {
    await model.insertMany(docs, { ordered: true });
  } catch (err) {
    throw new AppError(400, restoreFailureMessage(err, stage), err);
  }
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
 * Always remaps document ids/FKs so a backup from another (or lost) account can be
 * restored onto a newly registered account without `_id` collisions.
 * Does not change password or email; optionally updates display name from backup.
 */
export async function restoreUserBackup(
  userId: string,
  backup: BackupPayload
): Promise<RestoreSummary> {
  const userOid = new mongoose.Types.ObjectId(userId);
  const filter = { userId: userOid };

  // Sanitize + remap BEFORE wipe so a bad file does not empty the account first.
  const {
    accounts,
    categories,
    goals,
    investments,
    recurring,
    transactions,
    budgets,
    bankImports,
  } = prepareCollectionsForRestore(backup, userId);

  for (const [label, Model, docs] of [
    ["accounts", BankAccountModel, accounts],
    ["categories", CategoryModel, categories],
    ["goals", SavingsGoalModel, goals],
    ["investments", InvestmentModel, investments],
    ["recurring", RecurringTransactionModel, recurring],
    ["transactions", TransactionModel, transactions],
    ["budgets", BudgetModel, budgets],
    ["bankImports", BankImportModel, bankImports],
  ] as const) {
    for (let i = 0; i < docs.length; i++) {
      try {
        await Model.validate(docs[i]);
      } catch (err) {
        throw new AppError(400, restoreFailureMessage(err, `${label}[${i}]`), err);
      }
    }
  }

  // Wipe in reverse dependency order
  await TransactionModel.deleteMany(filter);
  await BudgetModel.deleteMany(filter);
  await BankImportModel.deleteMany(filter);
  await RecurringTransactionModel.deleteMany(filter);
  await InvestmentModel.deleteMany(filter);
  await SavingsGoalModel.deleteMany(filter);
  await CategoryModel.deleteMany(filter);
  await BankAccountModel.deleteMany(filter);

  await insertPrepared(BankAccountModel, accounts, "accounts");
  await insertPrepared(CategoryModel, categories, "categories");
  await insertPrepared(SavingsGoalModel, goals, "goals");
  await insertPrepared(InvestmentModel, investments, "investments");
  await insertPrepared(RecurringTransactionModel, recurring, "recurring");
  await insertPrepared(TransactionModel, transactions, "transactions");
  await insertPrepared(BudgetModel, budgets, "budgets");
  await insertPrepared(BankImportModel, bankImports, "bankImports");

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
