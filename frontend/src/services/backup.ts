"use client";

import api from "@/services/api";

export type BackupRestoreSummary = {
  accounts: number;
  categories: number;
  goals: number;
  investments: number;
  recurring: number;
  transactions: number;
  budgets: number;
  bankImports: number;
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header: string | undefined): string | null {
  if (!header) return null;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? null;
}

/** Download full JSON backup to the device */
export async function downloadFullBackup(): Promise<void> {
  try {
    const res = await api.get("/api/backup/download", { responseType: "blob" });
    const fromHeader = filenameFromDisposition(
      res.headers?.["content-disposition"] as string | undefined
    );
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const filename = fromHeader || `pocketa-backup-${stamp}.json`;
    const blob =
      res.data instanceof Blob
        ? res.data
        : new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
    triggerDownload(blob, filename);
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } })?.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { message?: string };
        if (parsed?.message) throw new Error(parsed.message);
      } catch (inner) {
        if (inner instanceof Error && !(inner instanceof SyntaxError)) throw inner;
      }
    }
    throw err;
  }
}

/** Parse a backup JSON file from disk */
export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("فایل JSON معتبر نیست");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("ساختار بکاپ نامعتبر است");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new Error("نسخه فایل بکاپ پشتیبانی نمی‌شود");
  }
  return parsed;
}

/** Replace all user data with the uploaded backup */
export async function restoreFullBackup(backup: unknown): Promise<BackupRestoreSummary> {
  const res = await api.post("/api/backup/restore", backup, {
    timeout: 120_000,
  });
  return res.data?.data?.summary as BackupRestoreSummary;
}
