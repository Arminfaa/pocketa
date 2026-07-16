import { CategoryModel } from "../models/Category";
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

function normalizeText(input: string): string {
  return toEnglishDigits(input)
    .replace(/\u200c/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

  function bump(
    cat: (typeof categories)[number],
    score: number
  ) {
    const id = String(cat._id);
    const prev = scores.get(id);
    if (prev) {
      prev.score += score;
      return;
    }
    scores.set(id, {
      _id: id,
      name: cat.name,
      type: cat.type as "income" | "expense",
      color: cat.color,
      icon: cat.icon,
      score,
    });
  }

  for (const cat of categories) {
    const name = normalizeText(cat.name);
    if (name.length >= 2 && title.includes(name)) {
      bump(cat, 6);
    }
  }

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
