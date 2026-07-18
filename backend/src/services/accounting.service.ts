import mongoose from "mongoose";
import { BankAccountModel } from "../models/BankAccount";
import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import { InvestmentModel } from "../models/Investment";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { OPENING_CATEGORY_NAME, ADJUSTMENT_CATEGORY_NAME } from "./account.service";
import { getMarketPrices } from "./market-prices.service";
import { resolveGoldKind, type InvestmentAssetType, type GoldKind } from "./investment.service";

export const TRANSFER_CATEGORY_NAME = "انتقال بین حساب‌ها";
export const INVESTMENT_PURCHASE_CATEGORY_NAME = "خرید سرمایه‌گذاری";
export const GOAL_CONTRIBUTION_CATEGORY_NAME = "پس‌انداز هدف";

/** Categories that are ledger plugs / non-operating — exclude from P&L & savings %. */
export const NON_OPERATING_CATEGORY_NAMES = [
  OPENING_CATEGORY_NAME,
  ADJUSTMENT_CATEGORY_NAME,
  TRANSFER_CATEGORY_NAME,
  INVESTMENT_PURCHASE_CATEGORY_NAME,
  GOAL_CONTRIBUTION_CATEGORY_NAME,
] as const;

export function toObjectId(id: string | mongoose.Types.ObjectId) {
  return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
}

export async function getActiveAccountIds(
  userId: string | mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  const accounts = await BankAccountModel.find({
    userId: toObjectId(userId),
    isActive: true,
  })
    .select("_id")
    .lean();
  return accounts.map((a) => a._id as mongoose.Types.ObjectId);
}

export async function getNonOperatingCategoryIds(
  userId: string | mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  const cats = await CategoryModel.find({
    userId: toObjectId(userId),
    name: { $in: [...NON_OPERATING_CATEGORY_NAMES] },
  })
    .select("_id")
    .lean();
  return cats.map((c) => c._id as mongoose.Types.ObjectId);
}

/** Match filter for operating cash-flow (excludes transfers & system plugs). */
export async function operatingTransactionMatch(
  userId: string | mongoose.Types.ObjectId,
  extra: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const nonOp = await getNonOperatingCategoryIds(userId);
  const match: Record<string, unknown> = {
    userId: toObjectId(userId),
    source: { $nin: ["transfer", "balance_adjustment", "investment", "goal"] },
    ...extra,
  };
  if (nonOp.length > 0) {
    match.categoryId = { $nin: nonOp };
  }
  // Preserve explicit categoryId from extra if caller set a positive filter
  if (extra.categoryId && nonOp.length > 0) {
    match.$and = [
      { categoryId: extra.categoryId },
      { categoryId: { $nin: nonOp } },
    ];
    delete match.categoryId;
  }
  return match;
}

export async function ensureTransferCategories(userId: string | mongoose.Types.ObjectId) {
  const uid = toObjectId(userId);
  let expense = await CategoryModel.findOne({
    userId: uid,
    name: TRANSFER_CATEGORY_NAME,
    type: "expense",
  });
  if (!expense) {
    expense = await CategoryModel.create({
      userId: uid,
      name: TRANSFER_CATEGORY_NAME,
      type: "expense",
      icon: "ArrowLeftRight",
      color: "#64748b",
    });
  }
  let income = await CategoryModel.findOne({
    userId: uid,
    name: TRANSFER_CATEGORY_NAME,
    type: "income",
  });
  if (!income) {
    income = await CategoryModel.create({
      userId: uid,
      name: TRANSFER_CATEGORY_NAME,
      type: "income",
      icon: "ArrowLeftRight",
      color: "#64748b",
    });
  }
  return { expense, income };
}

export async function ensureNamedCategory(
  userId: string | mongoose.Types.ObjectId,
  name: string,
  type: "income" | "expense",
  icon: string,
  color: string
) {
  const existing = await CategoryModel.findOne({
    userId: toObjectId(userId),
    name,
    type,
  });
  if (existing) return existing;
  return CategoryModel.create({
    userId: toObjectId(userId),
    name,
    type,
    icon,
    color,
  });
}

function unitPriceToman(
  assetType: InvestmentAssetType | string,
  goldKind: GoldKind | string | null | undefined,
  market: Awaited<ReturnType<typeof getMarketPrices>>
): number | null {
  if (assetType === "rial") return 1;
  if (assetType === "usd") return market.currency?.usdFreeToman ?? null;
  if (assetType === "gold") {
    if (resolveGoldKind(assetType, goldKind) === "quarter_coin") {
      return market.gold?.quarterCoinToman ?? null;
    }
    return market.gold?.gram18kToman ?? null;
  }
  return null;
}

/**
 * Net worth (personal balance sheet lite):
 * نقد فعال + ارزش روز سرمایه‌گذاری − بدهی‌های سررسید + طلب‌ها
 */
export async function computeNetWorth(userId: string | mongoose.Types.ObjectId) {
  const uid = toObjectId(userId);
  const activeIds = await getActiveAccountIds(uid);

  let cash = 0;
  if (activeIds.length > 0) {
    const rows = await TransactionModel.aggregate([
      { $match: { userId: uid, accountId: { $in: activeIds } } },
      { $group: { _id: "$type", sum: { $sum: "$amount" } } },
    ]);
    let income = 0;
    let expense = 0;
    for (const row of rows) {
      if (row._id === "income") income = row.sum ?? 0;
      if (row._id === "expense") expense = row.sum ?? 0;
    }
    cash = income - expense;
  }

  let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
  try {
    market = await getMarketPrices();
  } catch {
    market = null;
  }

  const investments = await InvestmentModel.find({ userId: uid, active: true }).lean();
  let investmentsValue = 0;
  let investmentsCost = 0;
  for (const inv of investments) {
    const q = Number(inv.quantity) || 0;
    const cost = Math.round(q * (Number(inv.purchasePricePerUnit) || 0));
    investmentsCost += cost;
    const goldKind = resolveGoldKind(inv.assetType, inv.goldKind);
    const unitNow = market ? unitPriceToman(inv.assetType, goldKind, market) : null;
    investmentsValue += unitNow != null ? Math.round(q * unitNow) : cost;
  }

  const dues = await RecurringTransactionModel.find({
    userId: uid,
    active: true,
  })
    .select("type amount")
    .lean();

  let liabilities = 0;
  let receivables = 0;
  for (const d of dues) {
    const amt = Number(d.amount) || 0;
    if (d.type === "expense") liabilities += amt;
    else receivables += amt;
  }

  const netWorth = cash + investmentsValue - liabilities + receivables;

  return {
    cash,
    investmentsValue,
    investmentsCost,
    liabilities,
    receivables,
    netWorth,
    activeAccountCount: activeIds.length,
  };
}
