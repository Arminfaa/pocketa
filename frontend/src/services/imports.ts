"use client";

import api from "@/services/api";

export type ImportParseMode = "sms" | "card_receipt";

export type ParsedImportItem = {
  type: "income" | "expense";
  amount: number;
  date: string;
  time?: string;
  balanceAfter?: number;
  bankName?: string;
  accountHint?: string;
  rawSnippet: string;
  importHash: string;
  parser: string;
  isDuplicate: boolean;
  suggestedTitle: string;
  /** When true, confirm import skips the naming/review queue */
  skipReview?: boolean;
  transferAmount?: number;
  feeAmount?: number;
};

export type BankSmsPreviewResponse = {
  jalaliYear: number;
  accountId: string;
  mode?: ImportParseMode;
  bankHint: string;
  parsedCount: number;
  duplicateCount: number;
  failedCount: number;
  items: ParsedImportItem[];
  failedBlocks: string[];
};

export type BankSmsConfirmResponse = {
  importedCount: number;
  skippedDuplicateCount: number;
  parsedCount: number;
};

export async function previewBankSms(payload: {
  rawText: string;
  accountId: string;
  jalaliYear?: number;
  mode?: ImportParseMode;
}): Promise<BankSmsPreviewResponse> {
  const res = await api.post("/api/imports/bank-sms/preview", payload);
  return res.data.data as BankSmsPreviewResponse;
}

export async function confirmBankSms(payload: {
  rawText: string;
  accountId: string;
  jalaliYear?: number;
  mode?: ImportParseMode;
  selectedHashes?: string[];
}): Promise<BankSmsConfirmResponse> {
  const res = await api.post("/api/imports/bank-sms/confirm", payload);
  return res.data.data as BankSmsConfirmResponse;
}
