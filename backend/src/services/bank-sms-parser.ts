import crypto from "crypto";
import { toEnglishDigits } from "../utils/normalizeDigits";

export type ParsedBankSms = {
  type: "income" | "expense";
  amount: number; // تومان
  amountRial?: number;
  date: string; // Jalali YYYY/MM/DD
  time?: string; // HH:mm
  balanceAfter?: number; // تومان
  bankName?: string;
  accountHint?: string;
  rawSnippet: string;
  importHash: string;
  parser: "pasargad" | "melli" | "generic";
  /** true when +/- was missing and type was inferred */
  typeInferred?: boolean;
  /** Melli «اصلاحيه» — reverses a prior same-amount opposite tx */
  isCorrection?: boolean;
};

/** بانک‌ها مبلغ را به ریال می‌فرستند؛ واحد اپ تومان است. */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10);
}

function parseAmountNumber(raw: string): number {
  return Number(toEnglishDigits(raw).replace(/,/g, "").replace(/\s/g, ""));
}

/** Normalize Persian/Arabic variants and invisible chars in bank SMS. */
export function normalizeSmsText(raw: string): string {
  return toEnglishDigits(raw)
    .replace(/\r\n/g, "\n")
    .replace(/[\u200c\u200e\u200f\u0640]/g, "") // ZWNJ / LTR / RTL / tatweel
    .replace(/ک/g, "ك")
    .replace(/ی/g, "ي")
    .replace(/آ/g, "ا")
    .trim();
}

export function buildImportHash(parts: {
  accountId: string;
  type: string;
  amount: number;
  date: string;
  time?: string;
  balanceAfter?: number;
}): string {
  const base = [
    parts.accountId,
    parts.type,
    parts.amount,
    parts.date,
    parts.time ?? "",
    parts.balanceAfter ?? "",
  ].join("|");
  return crypto.createHash("sha256").update(base).digest("hex");
}

function withHash(item: ParsedBankSms, accountId: string): ParsedBankSms {
  return {
    ...item,
    importHash: buildImportHash({
      accountId,
      type: item.type,
      amount: item.amount,
      date: item.date,
      time: item.time,
      balanceAfter: item.balanceAfter,
    }),
  };
}

function sortKey(item: ParsedBankSms): string {
  return `${item.date} ${item.time ?? "00:00"}`;
}

/** Infer unsigned transfer type from balance movement inside the batch. */
function inferUnsignedTypes(items: ParsedBankSms[]): ParsedBankSms[] {
  const sorted = [...items].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const inferred = new Map<string, "income" | "expense">();

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (!cur.typeInferred) continue;
    const prev = sorted
      .slice(0, i)
      .reverse()
      .find((x) => x.balanceAfter !== undefined);
    if (prev?.balanceAfter !== undefined && cur.balanceAfter !== undefined) {
      inferred.set(cur.rawSnippet + cur.date + cur.time, cur.balanceAfter >= prev.balanceAfter ? "income" : "expense");
    }
  }

  return items.map((item) => {
    if (!item.typeInferred) return item;
    const key = item.rawSnippet + item.date + item.time;
    const nextType = inferred.get(key);
    if (!nextType) return item;
    return { ...item, type: nextType };
  });
}

/**
 * Drop اصلاحیه and the prior same-amount opposite transaction it reverses.
 * Paste order matters (e.g. برداشت → اصلاحیه → برداشت again → keep only the last).
 */
export function cancelCorrectedPairs(items: ParsedBankSms[]): ParsedBankSms[] {
  const cancelled = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const cur = items[i]!;
    if (!cur.isCorrection || cancelled.has(i)) continue;

    for (let j = i - 1; j >= 0; j--) {
      if (cancelled.has(j)) continue;
      const prev = items[j]!;
      if (prev.isCorrection) continue;
      if (prev.amount !== cur.amount) continue;
      if (prev.type === cur.type) continue;
      if (
        prev.accountHint &&
        cur.accountHint &&
        prev.accountHint !== cur.accountHint
      ) {
        continue;
      }
      cancelled.add(j);
      cancelled.add(i);
      break;
    }
  }

  return items.filter((_, idx) => !cancelled.has(idx));
}

/** Split pasted text into individual SMS bodies. */
export function splitBankSmsBlocks(raw: string): string[] {
  const text = normalizeSmsText(raw);
  if (!text) return [];

  let parts: string[] = [];

  if (/\[[^\]]+\]\s*[^:\n]+:/.test(text)) {
    parts = text.split(/\n(?=\[[^\]]+\]\s*[^:\n]+:)/);
  } else if (/بانك\s*ملي|بانک\s*ملی/.test(text)) {
    parts = text.split(/(?=بانك\s*ملي|بانک\s*ملی)/);
  } else if (/\d{3}\.\d{3}\.[\d.]+/.test(text)) {
    parts = text.split(/(?=\d{3}\.\d{3}\.[\d.]+)/);
  } else {
    parts = text.split(/\n{2,}/);
  }

  return parts
    .map((p) => p.replace(/^\[[^\]]+\]\s*[^:\n]+:\s*/m, "").trim())
    .filter((p) => p.length > 0);
}

function extractPasargadFromText(text: string, jalaliYear: number): ParsedBankSms[] {
  const re =
    /(\d{3}\.\d{3}\.[\d.]+)\s*\n\s*([+-])\s*([\d,]+)\s*\n\s*(\d{1,2})\/(\d{1,2})_(\d{1,2}):(\d{2})\s*\n\s*مانده:\s*([\d,]+)/g;

  const items: ParsedBankSms[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const amountRial = parseAmountNumber(match[3]!);
    const balanceRial = parseAmountNumber(match[8]!);
    if (!Number.isFinite(amountRial) || amountRial <= 0) continue;

    items.push({
      type: match[2] === "+" ? "income" : "expense",
      amount: rialToToman(amountRial),
      amountRial,
      date: `${jalaliYear}/${match[4]!.padStart(2, "0")}/${match[5]!.padStart(2, "0")}`,
      time: `${match[6]!.padStart(2, "0")}:${match[7]!}`,
      balanceAfter: rialToToman(balanceRial),
      bankName: "پاسارگاد",
      accountHint: match[1],
      rawSnippet: match[0].slice(0, 500),
      importHash: "",
      parser: "pasargad",
    });
  }
  return items;
}

function parseMelliBlock(block: string, jalaliYear: number): ParsedBankSms | null {
  const b = normalizeSmsText(block);
  if (!b) return null;

  // 1) واريز / حقوق / يارانه
  // بانك ملي ايران
  // واريز
  // از بابت: حقوق/يارانه
  // حساب: ...
  // مبلغ: 6000000
  // 14050330-23:11:33
  if (/واريز/.test(b)) {
    const amountMatch = b.match(/مبلغ:\s*([\d,]+)/);
    const dateMatch = b.match(/(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2})(?::\d{2})?/);
    if (amountMatch) {
      const amountRial = parseAmountNumber(amountMatch[1]!);
      if (Number.isFinite(amountRial) && amountRial > 0) {
        const accountHint = b.match(/حساب:\s*(\d+)/)?.[1];
        let date = `${jalaliYear}/01/01`;
        let time: string | undefined;
        if (dateMatch) {
          date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
          time = `${dateMatch[4]}:${dateMatch[5]}`;
        }
        return {
          type: "income",
          amount: rialToToman(amountRial),
          amountRial,
          date,
          time,
          bankName: "ملی",
          accountHint,
          rawSnippet: b.slice(0, 500),
          importHash: "",
          parser: "melli",
        };
      }
    }
  }

  // 2) كارت + انتقال + تاريخ کامل (گاهی بدون علامت)
  // كارت: 8068
  // انتقال: 50,000,000
  // مانده: 56,169,314
  // تاريخ: 1405/03/31
  // ساعت: 00:09:49
  if (/كارت\s*:/.test(b) && /انتقال\s*:/.test(b)) {
    const amountMatch = b.match(/انتقال\s*:\s*([+-]?)([\d,]+)\s*([+-])?/);
    const balanceMatch = b.match(/مانده\s*:\s*([\d,]+)/);
    const dateMatch = b.match(/تاريخ\s*:\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    const timeMatch = b.match(/ساعت\s*:\s*(\d{1,2}):(\d{2})(?::\d{2})?/);
    const cardMatch = b.match(/كارت\s*:\s*(\d+)/);

    if (amountMatch && dateMatch) {
      const amountRial = parseAmountNumber(amountMatch[2]!);
      if (!Number.isFinite(amountRial) || amountRial <= 0) return null;

      const sign = amountMatch[1] || amountMatch[3] || "";
      const balanceRial = balanceMatch ? parseAmountNumber(balanceMatch[1]!) : undefined;
      const date = `${dateMatch[1]}/${dateMatch[2]!.padStart(2, "0")}/${dateMatch[3]!.padStart(2, "0")}`;
      const time = timeMatch
        ? `${timeMatch[1]!.padStart(2, "0")}:${timeMatch[2]}`
        : undefined;

      const typeInferred = !sign;
      const type: "income" | "expense" =
        sign === "+" ? "income" : sign === "-" ? "expense" : "expense";

      return {
        type,
        typeInferred,
        amount: rialToToman(amountRial),
        amountRial,
        date,
        time,
        balanceAfter: balanceRial !== undefined ? rialToToman(balanceRial) : undefined,
        bankName: "ملی",
        accountHint: cardMatch?.[1],
        rawSnippet: b.slice(0, 500),
        importHash: "",
        parser: "melli",
      };
    }
  }

  // 3) انتقال / اصلاحيه با علامت +/- و تاریخ MMDD-HH:mm
  // انتقال:34,418,600-
  // اصلاحيه:10,712,200+
  const signedMatch = b.match(/(انتقال|اصلاحيه)\s*:\s*([\d,]+)\s*([+-])/);
  if (signedMatch) {
    const kind = signedMatch[1]!;
    const amountRial = parseAmountNumber(signedMatch[2]!);
    const sign = signedMatch[3]!;
    if (!Number.isFinite(amountRial) || amountRial <= 0) return null;

    const dateMatch = b.match(/(\d{2})(\d{2})-(\d{2}):(\d{2})/);
    if (!dateMatch) return null;

    const balanceMatch = b.match(/مانده\s*:\s*([\d,]+)/);
    const accountHint = b.match(/حساب\s*:\s*(\d+)/)?.[1];
    const balanceRial = balanceMatch ? parseAmountNumber(balanceMatch[1]!) : undefined;

    return {
      type: sign === "+" ? "income" : "expense",
      amount: rialToToman(amountRial),
      amountRial,
      date: `${jalaliYear}/${dateMatch[1]!}/${dateMatch[2]!}`,
      time: `${dateMatch[3]!}:${dateMatch[4]!}`,
      balanceAfter: balanceRial !== undefined ? rialToToman(balanceRial) : undefined,
      bankName: "ملی",
      accountHint,
      rawSnippet: b.slice(0, 500),
      importHash: "",
      parser: "melli",
      isCorrection: kind === "اصلاحيه",
    };
  }

  // 4) انتقال بدون علامت ولی با تاریخ کوتاه
  const unsignedShort = b.match(/انتقال\s*:\s*([\d,]+)\b/);
  if (unsignedShort) {
    const amountRial = parseAmountNumber(unsignedShort[1]!);
    if (!Number.isFinite(amountRial) || amountRial <= 0) return null;
    const dateMatch = b.match(/(\d{2})(\d{2})-(\d{2}):(\d{2})/);
    if (!dateMatch) return null;
    const balanceMatch = b.match(/مانده\s*:\s*([\d,]+)/);
    const balanceRial = balanceMatch ? parseAmountNumber(balanceMatch[1]!) : undefined;

    return {
      type: "expense",
      typeInferred: true,
      amount: rialToToman(amountRial),
      amountRial,
      date: `${jalaliYear}/${dateMatch[1]!}/${dateMatch[2]!}`,
      time: `${dateMatch[3]!}:${dateMatch[4]!}`,
      balanceAfter: balanceRial !== undefined ? rialToToman(balanceRial) : undefined,
      bankName: "ملی",
      accountHint: b.match(/حساب\s*:\s*(\d+)/)?.[1],
      rawSnippet: b.slice(0, 500),
      importHash: "",
      parser: "melli",
    };
  }

  return null;
}

function extractMelliFromText(text: string, jalaliYear: number): ParsedBankSms[] {
  const normalized = normalizeSmsText(text);
  const blocks = normalized
    .split(/(?=بانك\s*ملي)/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && /بانك\s*ملي/.test(x));

  // If header split failed but content looks like melli fields, treat whole text as blocks via blank lines
  const sourceBlocks =
    blocks.length > 0
      ? blocks
      : /انتقال\s*:|واريز|اصلاحيه/.test(normalized)
        ? splitBankSmsBlocks(normalized)
        : [];

  const items: ParsedBankSms[] = [];
  for (const block of sourceBlocks) {
    const parsed = parseMelliBlock(block, jalaliYear);
    if (parsed) items.push(parsed);
  }

  return cancelCorrectedPairs(inferUnsignedTypes(items));
}

function extractPasargadSafe(text: string, jalaliYear: number): ParsedBankSms[] {
  // Avoid treating Melli dumps as Pasargad
  if (/بانك\s*ملي/.test(normalizeSmsText(text)) && !/\d{3}\.\d{3}\.[\d.]+/.test(text)) {
    return [];
  }
  return extractPasargadFromText(text, jalaliYear);
}

export function parseBankSmsBlock(block: string, jalaliYear: number): ParsedBankSms | null {
  const normalized = normalizeSmsText(block);
  if (!normalized) return null;

  if (/بانك\s*ملي|انتقال\s*:|واريز|اصلاحيه/.test(normalized)) {
    const melli = parseMelliBlock(normalized, jalaliYear);
    if (melli) return melli;
  }

  const pasargad = extractPasargadFromText(normalized, jalaliYear)[0];
  if (pasargad) return pasargad;

  return null;
}

export function parseBankSmsText(
  rawText: string,
  jalaliYear: number,
  accountId: string
): { items: ParsedBankSms[]; failedBlocks: string[] } {
  const text = normalizeSmsText(rawText);
  const failedBlocks: string[] = [];

  const melliItems = extractMelliFromText(text, jalaliYear);
  const pasargadItems = extractPasargadSafe(text, jalaliYear);
  const extracted = [...pasargadItems, ...melliItems];

  if (extracted.length > 0) {
    extracted.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return {
      items: extracted.map((item) => withHash(item, accountId)),
      failedBlocks,
    };
  }

  const blocks = splitBankSmsBlocks(text);
  const items: ParsedBankSms[] = [];

  for (const block of blocks) {
    const parsed = parseBankSmsBlock(block, jalaliYear);
    if (!parsed) {
      failedBlocks.push(block.slice(0, 200));
      continue;
    }
    items.push(withHash(parsed, accountId));
  }

  return {
    items: cancelCorrectedPairs(inferUnsignedTypes(items)).map((i) => withHash(i, accountId)),
    failedBlocks,
  };
}
