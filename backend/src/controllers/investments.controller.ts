import type { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError } from "../utils/AppError";
import { sendSuccess } from "../utils/apiResponse";
import { InvestmentModel } from "../models/Investment";
import { RecurringTransactionModel } from "../models/RecurringTransaction";
import { InvestmentCreateSchema, InvestmentUpdateSchema } from "../validations/investments";
import { normalizeJalaliDate } from "../utils/normalizeDigits";
import { getMarketPrices } from "../services/market-prices.service";
import {
  assetTypeLabel,
  computeProfitAssetQuantity,
  ensureInvestmentIncomeCategory,
  formatAssetQuantity,
  resolveGoldKind,
  type GoldKind,
  type InvestmentAssetType,
} from "../services/investment.service";

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

function dayOfMonthFromJalali(date: string): number {
  const parts = normalizeJalaliDate(date).split("/").map(Number);
  return parts[2] ?? 1;
}

async function mapInvestment(
  inv: {
    _id: unknown;
    title: string;
    assetType: InvestmentAssetType | string;
    goldKind?: GoldKind | string | null;
    quantity: number;
    purchasePricePerUnit: number;
    purchaseDate: string;
    hasProfit: boolean;
    profitMode?: string | null;
    profitValue?: number | null;
    profitFrequency?: string | null;
    profitNextDate?: string | null;
    profitEndDate?: string | null;
    profitAssetQuantity?: number | null;
    recurringId?: unknown;
    notes?: string | null;
    active: boolean;
    createdAt?: Date;
  },
  market: Awaited<ReturnType<typeof getMarketPrices>> | null
) {
  const goldKind = resolveGoldKind(inv.assetType, inv.goldKind);
  const unitNow = market ? unitPriceToman(inv.assetType, goldKind, market) : null;
  const costBasis = inv.quantity * inv.purchasePricePerUnit;
  const currentValue = unitNow != null ? inv.quantity * unitNow : null;
  const unrealizedPnl = currentValue != null ? currentValue - costBasis : null;
  const profitQty = inv.profitAssetQuantity ?? 0;
  const profitTomanPerPeriod =
    unitNow != null && profitQty > 0 ? Math.round(profitQty * unitNow) : null;

  return {
    id: inv._id,
    title: inv.title,
    assetType: inv.assetType,
    goldKind,
    quantity: inv.quantity,
    purchasePricePerUnit: inv.purchasePricePerUnit,
    purchaseDate: inv.purchaseDate,
    hasProfit: inv.hasProfit,
    profitMode: inv.profitMode ?? null,
    profitValue: inv.profitValue ?? null,
    profitFrequency: inv.profitFrequency ?? null,
    profitNextDate: inv.profitNextDate ?? "",
    profitEndDate: inv.profitEndDate ?? "",
    profitAssetQuantity: profitQty,
    profitTomanPerPeriod,
    recurringId: inv.recurringId ?? null,
    notes: inv.notes ?? "",
    active: inv.active,
    costBasis: Math.round(costBasis),
    currentUnitPrice: unitNow,
    currentValue: currentValue != null ? Math.round(currentValue) : null,
    unrealizedPnl: unrealizedPnl != null ? Math.round(unrealizedPnl) : null,
    createdAt: inv.createdAt,
  };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const includeInactive = String(req.query.includeInactive ?? "") === "true";
  const filter: Record<string, unknown> = { userId };
  if (!includeInactive) filter.active = true;

  const items = await InvestmentModel.find(filter).sort({ createdAt: -1 });

  let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
  try {
    market = await getMarketPrices();
  } catch {
    market = null;
  }

  const mapped = await Promise.all(items.map((i) => mapInvestment(i, market)));

  const withValue = mapped.filter((i) => i.currentValue != null);
  const totalCost = mapped.reduce((s, i) => s + i.costBasis, 0);
  const totalValue = withValue.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  const totalPnl = withValue.reduce((s, i) => s + (i.unrealizedPnl ?? 0), 0);

  const goldMeltedQty = mapped
    .filter((i) => i.assetType === "gold" && i.goldKind !== "quarter_coin")
    .reduce((s, i) => s + i.quantity, 0);
  const quarterCoinQty = mapped
    .filter((i) => i.assetType === "gold" && i.goldKind === "quarter_coin")
    .reduce((s, i) => s + i.quantity, 0);

  return sendSuccess(res, {
    items: mapped,
    summary: {
      count: mapped.length,
      totalCost,
      totalValue: withValue.length ? totalValue : null,
      totalUnrealizedPnl: withValue.length ? totalPnl : null,
      goldQuantity: goldMeltedQty,
      quarterCoinQuantity: quarterCoinQty,
      usdQuantity: mapped
        .filter((i) => i.assetType === "usd")
        .reduce((s, i) => s + i.quantity, 0),
      rialQuantity: mapped
        .filter((i) => i.assetType === "rial")
        .reduce((s, i) => s + i.quantity, 0),
    },
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = InvestmentCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const data = parsed.data;
  const purchaseDate = normalizeJalaliDate(data.purchaseDate);
  const profitAssetQuantity = computeProfitAssetQuantity(data);
  const goldKind = resolveGoldKind(data.assetType, data.goldKind);
  const purchasePricePerUnit =
    data.assetType === "rial" ? 1 : data.purchasePricePerUnit;

  const investment = await InvestmentModel.create({
    userId,
    title: data.title,
    assetType: data.assetType,
    goldKind: data.assetType === "gold" ? goldKind : undefined,
    quantity: data.quantity,
    purchasePricePerUnit,
    purchaseDate,
    hasProfit: data.hasProfit,
    profitMode: data.hasProfit ? data.profitMode : undefined,
    profitValue: data.hasProfit ? data.profitValue : undefined,
    profitFrequency: data.hasProfit ? data.profitFrequency : undefined,
    profitNextDate:
      data.hasProfit && data.profitNextDate
        ? normalizeJalaliDate(data.profitNextDate)
        : "",
    profitEndDate:
      data.hasProfit && data.profitEndDate ? normalizeJalaliDate(data.profitEndDate) : "",
    profitAssetQuantity: data.hasProfit ? profitAssetQuantity : 0,
    notes: data.notes ?? "",
    active: true,
  });

  if (data.hasProfit && profitAssetQuantity > 0 && data.profitNextDate && data.profitFrequency) {
    const category = await ensureInvestmentIncomeCategory(userId);
    let marketAmount = 1;
    try {
      const market = await getMarketPrices();
      const unit = unitPriceToman(data.assetType, goldKind, market);
      if (unit != null) marketAmount = Math.max(1, Math.round(profitAssetQuantity * unit));
    } catch {
      marketAmount = Math.max(1, Math.round(profitAssetQuantity * purchasePricePerUnit));
    }

    const assetLabel = formatAssetQuantity(profitAssetQuantity, data.assetType, goldKind);
    const nextDate = normalizeJalaliDate(data.profitNextDate);
    const freq = data.profitFrequency;
    const dayOfMonth = dayOfMonthFromJalali(nextDate);

    const recurring = await RecurringTransactionModel.create({
      userId,
      title: `سود ${assetLabel} — ${data.title}`,
      amount: marketAmount,
      baseAmount: marketAmount,
      type: "income",
      kind: "recurring",
      categoryId: category._id,
      dayOfMonth,
      endMode: "forever",
      paymentsMade: 0,
      reminderHour: 20,
      reminderSentKeys: [],
      nextPaymentDate: nextDate,
      active: true,
      notes: `سود سرمایه‌گذاری (${assetTypeLabel(data.assetType, goldKind)})`,
      investmentId: investment._id,
      assetQuantity: profitAssetQuantity,
      assetType: data.assetType,
      goldKind: data.assetType === "gold" ? goldKind : undefined,
      scheduleFrequency: freq,
      endDate: data.profitEndDate ? normalizeJalaliDate(data.profitEndDate) : "",
    });

    investment.recurringId = recurring._id;
    await investment.save();
  }

  let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
  try {
    market = await getMarketPrices();
  } catch {
    market = null;
  }

  return sendSuccess(
    res,
    { item: await mapInvestment(investment, market) },
    "سرمایه‌گذاری ثبت شد",
    201
  );
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const parsed = InvestmentUpdateSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, "خطا در اعتبارسنجی داده‌ها", parsed.error.flatten());

  const { id } = req.params;
  const existing = await InvestmentModel.findOne({ _id: id, userId });
  if (!existing) throw new AppError(404, "سرمایه‌گذاری یافت نشد");

  const next: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.purchaseDate) next.purchaseDate = normalizeJalaliDate(parsed.data.purchaseDate);
  if (parsed.data.profitEndDate !== undefined) {
    next.profitEndDate =
      parsed.data.profitEndDate && parsed.data.profitEndDate !== ""
        ? normalizeJalaliDate(parsed.data.profitEndDate)
        : "";
  }
  if (parsed.data.notes !== undefined) next.notes = parsed.data.notes ?? "";

  if (parsed.data.quantity != null && existing.hasProfit && existing.profitMode === "percent") {
    next.profitAssetQuantity = computeProfitAssetQuantity({
      quantity: parsed.data.quantity,
      hasProfit: true,
      profitMode: "percent",
      profitValue: existing.profitValue,
    });
  }

  const investment = await InvestmentModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: next },
    { returnDocument: "after" }
  );
  if (!investment) throw new AppError(404, "سرمایه‌گذاری یافت نشد");

  if (investment.recurringId) {
    const patch: Record<string, unknown> = {};
    if (typeof next.profitAssetQuantity === "number") {
      patch.assetQuantity = next.profitAssetQuantity;
    }
    if (parsed.data.profitEndDate !== undefined) {
      patch.endDate = investment.profitEndDate || "";
    }
    if (parsed.data.active === false) {
      patch.active = false;
    }
    if (parsed.data.title) {
      const qty = investment.profitAssetQuantity ?? 0;
      patch.title = `سود ${formatAssetQuantity(qty, investment.assetType, investment.goldKind)} — ${investment.title}`;
    }
    if (Object.keys(patch).length) {
      await RecurringTransactionModel.updateOne(
        { _id: investment.recurringId, userId },
        { $set: patch }
      );
    }
  }

  let market: Awaited<ReturnType<typeof getMarketPrices>> | null = null;
  try {
    market = await getMarketPrices();
  } catch {
    market = null;
  }

  return sendSuccess(res, { item: await mapInvestment(investment, market) });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new AppError(401, "عدم دسترسی");

  const { id } = req.params;
  const deleted = await InvestmentModel.findOneAndDelete({ _id: id, userId });
  if (!deleted) throw new AppError(404, "سرمایه‌گذاری یافت نشد");

  if (deleted.recurringId) {
    await RecurringTransactionModel.updateOne(
      { _id: deleted.recurringId, userId },
      { $set: { active: false } }
    );
  }

  return sendSuccess(res, { id }, "حذف شد");
});
