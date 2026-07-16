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
};

/** بانک‌ها مبلغ را به ریال می‌فرستند؛ واحد اپ تومان است. */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10);
}

function parseAmountNumber(raw: string): number {
  return Number(toEnglishDigits(raw).replace(/,/g, "").replace(/\s/g, ""));
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

/** Split pasted text into individual SMS bodies. */
export function splitBankSmsBlocks(raw: string): string[] {
  const text = toEnglishDigits(raw).replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  let parts: string[] = [];

  if (/\[[^\]]+\]\s*[^:\n]+:/.test(text)) {
    parts = text.split(/\n(?=\[[^\]]+\]\s*[^:\n]+:)/);
  } else if (/\d{3}\.\d{3}\.[\d.]+/.test(text)) {
    // Pasargad-style stacked SMS without blank lines
    parts = text.split(/(?=\d{3}\.\d{3}\.[\d.]+)/);
  } else if (/بانك\s*ملي|بانک\s*ملی/.test(text)) {
    parts = text.split(/(?=بانك\s*ملي|بانک\s*ملی)/);
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

    const month = match[4]!.padStart(2, "0");
    const day = match[5]!.padStart(2, "0");
    const hour = match[6]!.padStart(2, "0");
    const minute = match[7]!.padStart(2, "0");
    const sign = match[2]!;

    items.push({
      type: sign === "+" ? "income" : "expense",
      amount: rialToToman(amountRial),
      amountRial,
      date: `${jalaliYear}/${month}/${day}`,
      time: `${hour}:${minute}`,
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

function extractMelliFromText(text: string, jalaliYear: number): ParsedBankSms[] {
  const re =
    /(?:بانك\s*ملي\s*ايران|بانک\s*ملی\s*ایران)?\s*انتقال:\s*([\d,]+)\s*([+-])\s*حساب:\s*(\d+)\s*مانده:\s*([\d,]+)\s*(\d{2})(\d{2})-(\d{2}):(\d{2})/g;

  const items: ParsedBankSms[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const amountRial = parseAmountNumber(match[1]!);
    const balanceRial = parseAmountNumber(match[4]!);
    if (!Number.isFinite(amountRial) || amountRial <= 0) continue;

    const sign = match[2]!;
    items.push({
      type: sign === "+" ? "income" : "expense",
      amount: rialToToman(amountRial),
      amountRial,
      date: `${jalaliYear}/${match[5]!}/${match[6]!}`,
      time: `${match[7]!}:${match[8]!}`,
      balanceAfter: rialToToman(balanceRial),
      bankName: "ملی",
      accountHint: match[3],
      rawSnippet: match[0].slice(0, 500),
      importHash: "",
      parser: "melli",
    });
  }
  return items;
}

function parsePasargad(block: string, jalaliYear: number): ParsedBankSms | null {
  const extracted = extractPasargadFromText(block, jalaliYear);
  return extracted[0] ?? null;
}

function parseMelli(block: string, jalaliYear: number): ParsedBankSms | null {
  const extracted = extractMelliFromText(block, jalaliYear);
  if (extracted[0]) return extracted[0];

  // Looser single-block fallback
  const amountMatch = block.match(/انتقال:\s*([\d,]+)\s*([+-])/);
  if (!amountMatch) return null;

  const amountRial = parseAmountNumber(amountMatch[1]!);
  const sign = amountMatch[2]!;
  if (!Number.isFinite(amountRial) || amountRial <= 0) return null;

  const dateMatch = block.match(/(\d{2})(\d{2})-(\d{2}):(\d{2})/);
  if (!dateMatch) return null;

  const balanceMatch = block.match(/مانده:\s*([\d,]+)/);
  const balanceRial = balanceMatch ? parseAmountNumber(balanceMatch[1]!) : undefined;
  const accountHintMatch = block.match(/حساب:\s*(\d+)/);

  return {
    type: sign === "+" ? "income" : "expense",
    amount: rialToToman(amountRial),
    amountRial,
    date: `${jalaliYear}/${dateMatch[1]!}/${dateMatch[2]!}`,
    time: `${dateMatch[3]!}:${dateMatch[4]!}`,
    balanceAfter: balanceRial !== undefined ? rialToToman(balanceRial) : undefined,
    bankName: "ملی",
    accountHint: accountHintMatch?.[1],
    rawSnippet: block.slice(0, 500),
    importHash: "",
    parser: "melli",
  };
}

function parseGeneric(block: string, jalaliYear: number): ParsedBankSms | null {
  const amountMatch =
    block.match(/(^|\n)\s*([+-])\s*([\d,]{4,})\s*(?=\n|$)/) ||
    block.match(/([\d,]{4,})\s*([+-])/);

  if (!amountMatch) return null;

  let sign: string;
  let amountRaw: string;
  if (amountMatch[2] === "+" || amountMatch[2] === "-") {
    sign = amountMatch[2]!;
    amountRaw = amountMatch[3]!;
  } else {
    amountRaw = amountMatch[1]!;
    sign = amountMatch[2]!;
  }

  const amountRial = parseAmountNumber(amountRaw);
  if (!Number.isFinite(amountRial) || amountRial <= 0) return null;

  let date = `${jalaliYear}/01/01`;
  let time: string | undefined;

  const pasargadDate = block.match(/(\d{1,2})\/(\d{1,2})_(\d{1,2}):(\d{2})/);
  const melliDate = block.match(/(\d{2})(\d{2})-(\d{2}):(\d{2})/);
  if (pasargadDate) {
    date = `${jalaliYear}/${pasargadDate[1]!.padStart(2, "0")}/${pasargadDate[2]!.padStart(2, "0")}`;
    time = `${pasargadDate[3]!.padStart(2, "0")}:${pasargadDate[4]!}`;
  } else if (melliDate) {
    date = `${jalaliYear}/${melliDate[1]!}/${melliDate[2]!}`;
    time = `${melliDate[3]!}:${melliDate[4]!}`;
  }

  const balanceMatch = block.match(/مانده:\s*([\d,]+)/);
  const balanceRial = balanceMatch ? parseAmountNumber(balanceMatch[1]!) : undefined;

  return {
    type: sign === "+" ? "income" : "expense",
    amount: rialToToman(amountRial),
    amountRial,
    date,
    time,
    balanceAfter: balanceRial !== undefined ? rialToToman(balanceRial) : undefined,
    bankName: undefined,
    accountHint: undefined,
    rawSnippet: block.slice(0, 500),
    importHash: "",
    parser: "generic",
  };
}

export function parseBankSmsBlock(block: string, jalaliYear: number): ParsedBankSms | null {
  const normalized = toEnglishDigits(block).trim();
  if (!normalized) return null;

  if (/بانك\s*ملي|بانک\s*ملی|انتقال:/.test(normalized)) {
    const melli = parseMelli(normalized, jalaliYear);
    if (melli) return melli;
  }

  const pasargad = parsePasargad(normalized, jalaliYear);
  if (pasargad) return pasargad;

  if (/انتقال:/.test(normalized)) {
    const melli = parseMelli(normalized, jalaliYear);
    if (melli) return melli;
  }

  return parseGeneric(normalized, jalaliYear);
}

export function parseBankSmsText(
  rawText: string,
  jalaliYear: number,
  accountId: string
): { items: ParsedBankSms[]; failedBlocks: string[] } {
  const text = toEnglishDigits(rawText).replace(/\r\n/g, "\n").trim();
  const failedBlocks: string[] = [];

  // Prefer global extraction so stacked SMS without blank lines still become N items.
  const extracted = [
    ...extractPasargadFromText(text, jalaliYear),
    ...extractMelliFromText(text, jalaliYear),
  ];

  if (extracted.length > 0) {
    // Sort by date+time ascending for stable preview
    extracted.sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
    return {
      items: extracted.map((item) => withHash(item, accountId)),
      failedBlocks,
    };
  }

  // Fallback: split then parse one-by-one
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

  return { items, failedBlocks };
}
