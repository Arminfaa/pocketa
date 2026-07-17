import { CategoryModel } from "../models/Category";

/** Ensure the default "بدهی" expense category exists for the user. */
export async function ensureDebtExpenseCategory(userId: string) {
  const existing = await CategoryModel.findOne({
    userId,
    type: "expense",
    name: "بدهی",
  });
  if (existing) return existing;

  return CategoryModel.create({
    userId,
    name: "بدهی",
    type: "expense",
    icon: "HandCoins",
    color: "#f97316",
  });
}

/** Ensure the default "طلب" income category exists for the user. */
export async function ensureReceivableIncomeCategory(userId: string) {
  const existing = await CategoryModel.findOne({
    userId,
    type: "income",
    name: "طلب",
  });
  if (existing) return existing;

  return CategoryModel.create({
    userId,
    name: "طلب",
    type: "income",
    icon: "HandCoins",
    color: "#10b981",
  });
}
