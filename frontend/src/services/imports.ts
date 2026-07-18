"use client";

import api from "@/services/api";

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
  /** Card-to-card etc. — already titled, no review queue */
  skipReview?: boolean;
};

export type BankSmsPreviewResponse = {
  jalaliYear: number;
  accountId: string;
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
}): Promise<BankSmsPreviewResponse> {
  const res = await api.post("/api/imports/bank-sms/preview", payload);
  return res.data.data as BankSmsPreviewResponse;
}

export async function confirmBankSms(payload: {
  rawText: string;
  accountId: string;
  jalaliYear?: number;
  selectedHashes?: string[];
}): Promise<BankSmsConfirmResponse> {
  const res = await api.post("/api/imports/bank-sms/confirm", payload);
  return res.data.data as BankSmsConfirmResponse;
}
