import { CategoryModel } from "../models/Category";
import { TransactionModel } from "../models/Transaction";
import { toEnglishDigits } from "../utils/normalizeDigits";

type CategoryHit = {
  _id: string;
  name: string;
  type: "income" | "expense";
  color?: string;
  icon?: string;
  score: number;
};

/** Keyword → preferred default category names (matched against user's categories). */
const RULES: Array<{
  keywords: string[];
  categoryNames: string[];
  type?: "income" | "expense";
  weight?: number;
}> = [
  { keywords: ["حقوق", "دستمزد", "salary", "واریز حقوق"], categoryNames: ["حقوق"], type: "income", weight: 5 },
  { keywords: ["فریلنس", "پروژه", "قرارداد"], categoryNames: ["پروژه فریلنسری"], type: "income", weight: 4 },
  { keywords: ["سود", "سهام", "صندوق", "سرمایه"], categoryNames: ["سرمایه گذاری"], type: "income", weight: 3 },
  { keywords: ["هدیه", "کادو", "عیدی"], categoryNames: ["هدیه"], weight: 3 },
  {
    keywords: ["رستوران", "کافه", "غذا", "ناهار", "شام", "اسنپ فود", "اسنپ‌فود", "دیجی‌فود", "خوراک"],
    categoryNames: ["خوراک"],
    type: "expense",
    weight: 4,
  },
  {
    keywords: ["اسنپ", "تپسی", "بنزین", "مترو", "تاکسی", "حمل", "پارکینگ", "عوارض"],
    categoryNames: ["حمل و نقل"],
    type: "expense",
    weight: 4,
  },
  {
    keywords: ["دیجی کالا", "دیجیکالا", "خرید", "بازار", "فروشگاه", "لباس"],
    categoryNames: ["خرید"],
    type: "expense",
    weight: 3,
  },
  {
    keywords: ["قبض", "برق", "گاز", "آب", "اینترنت", "همراه اول", "ایرانسل", "مخابرات", "اجاره"],
    categoryNames: ["قبض‌ها"],
    type: "expense",
    weight: 4,
  },
  {
    keywords: ["سینما", "کنسرت", "بازی", "تفریح", "سفر", "هتل"],
    categoryNames: ["تفریح"],
    type: "expense",
    weight: 3,
  },
  {
    keywords: ["دکتر", "دارو", "بیمارستان", "درمان", "دندان", "آزمایش"],
    categoryNames: ["درمان"],
    type: "expense",
    weight: 4,
  },
  {
    keywords: ["کلاس", "شهریه", "آموزش", "کتاب", "دوره", "دانشگاه"],
    categoryNames: ["آموزش"],
    type: "expense",
    weight: 3,
  },
];

/** Generic import / system titles — never use as learning anchors. */
const GENERIC_TITLE_RE =
  /بدون عنوان|واریز بانکی|برداشت بانکی|واریز بررسی|برداشت بررسی|^خرید |^فروش |انتقال بین حساب|تعدیل موجودی|موجودی اولیه/;

function normalizeText(input: string): string {
  return toEnglishDigits(input)
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function scoreFromHistory(params: {
  userId: string;
  title: string;
  type?: "income" | "expense";
  bumpById: (categoryId: string, score: number) => void;
  categoryIds: Set<string>;
}): Promise<void> {
  const title = params.title;
  if (title.length < 2 || GENERIC_TITLE_RE.test(title)) return;

  const filter: Record<string, unknown> = {
    userId: params.userId,
    needsReview: false,
    categoryId: { $exists: true, $ne: null },
  };
  if (params.type) filter.type = params.type;

  const past = await TransactionModel.find(filter)
    .select("title categoryId type")
    .sort({ updatedAt: -1 })
    .limit(400)
    .lean();

  for (const tx of past) {
    const pastTitle = normalizeText(String(tx.title ?? ""));
    if (pastTitle.length < 2 || GENERIC_TITLE_RE.test(pastTitle)) continue;
    const categoryId = String(tx.categoryId);
    if (!params.categoryIds.has(categoryId)) continue;

    if (pastTitle === title) {
      params.bumpById(categoryId, 20);
      continue;
    }
    // Fuzzy: shared substring of meaningful length
    if (pastTitle.length >= 4 && title.includes(pastTitle)) {
      params.bumpById(categoryId, 14);
    } else if (title.length >= 4 && pastTitle.includes(title)) {
      params.bumpById(categoryId, 12);
    }
  }
}

export async function suggestCategoryForTitle(params: {
  userId: string;
  title: string;
  type?: "income" | "expense";
}): Promise<{ suggestion: CategoryHit | null; alternatives: CategoryHit[] }> {
  const title = normalizeText(params.title ?? "");
  if (title.length < 2) {
    return { suggestion: null, alternatives: [] };
  }

  const filter: Record<string, unknown> = { userId: params.userId };
  if (params.type) filter.type = params.type;

  const categories = await CategoryModel.find(filter).lean();
  if (categories.length === 0) {
    return { suggestion: null, alternatives: [] };
  }

  const scores = new Map<string, CategoryHit>();

  const byId = new Map(categories.map((c) => [String(c._id), c]));

  function bumpById(categoryId: string, score: number) {
    const cat = byId.get(categoryId);
    if (!cat) return;
    const prev = scores.get(categoryId);
    if (prev) {
      prev.score += score;
      return;
    }
    scores.set(categoryId, {
      _id: categoryId,
      name: cat.name,
      type: cat.type as "income" | "expense",
      color: cat.color,
      icon: cat.icon,
      score,
    });
  }

  function bump(cat: (typeof categories)[number], score: number) {
    bumpById(String(cat._id), score);
  }

  // 1) Learn from user's previously named/reviewed transactions
  await scoreFromHistory({
    userId: params.userId,
    title,
    type: params.type,
    bumpById,
    categoryIds: new Set(byId.keys()),
  });

  // 2) Title contains category name
  for (const cat of categories) {
    const name = normalizeText(cat.name);
    if (name.length >= 2 && title.includes(name)) {
      bump(cat, 6);
    }
  }

  // 3) Static keyword rules
  for (const rule of RULES) {
    if (params.type && rule.type && rule.type !== params.type) continue;
    const hit = rule.keywords.some((kw) => title.includes(normalizeText(kw)));
    if (!hit) continue;
    const weight = rule.weight ?? 3;
    for (const cat of categories) {
      if (params.type && cat.type !== params.type) continue;
      if (rule.type && cat.type !== rule.type) continue;
      const catName = normalizeText(cat.name);
      if (rule.categoryNames.some((n) => normalizeText(n) === catName || catName.includes(normalizeText(n)))) {
        bump(cat, weight);
      }
    }
  }

  const ranked = [...scores.values()].sort((a, b) => b.score - a.score);
  return {
    suggestion: ranked[0] ?? null,
    alternatives: ranked.slice(0, 3),
  };
}
