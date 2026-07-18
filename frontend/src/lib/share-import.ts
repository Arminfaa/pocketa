export const SHARE_IMPORT_STORAGE_KEY = "pocketa.shareImportText";
export const SHARE_IMPORT_CACHE = "pocketa-share-v1";
export const SHARE_IMPORT_CACHE_URL = "/__shared_import_text";

export type ShareImportMode = "sms" | "card_receipt";

/** Merge title/text/url from Web Share Target into one paste payload. */
export function combineShareParts(parts: {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}): string {
  const title = String(parts.title ?? "").trim();
  const text = String(parts.text ?? "").trim();
  const url = String(parts.url ?? "").trim();

  // Most SMS / Notes apps put the body in `text`
  if (text) {
    if (title && !text.includes(title) && title.length <= 80) {
      return `${title}\n${text}`.trim();
    }
    return text;
  }

  return [title, url].filter(Boolean).join("\n").trim();
}

export function detectImportModeFromText(raw: string): ShareImportMode {
  const t = raw.replace(/ي/g, "ی").replace(/ك/g, "ک");
  if (/رسید\s*کارت\s*به\s*کارت/.test(t)) return "card_receipt";
  return "sms";
}

export function saveShareImportText(text: string): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(SHARE_IMPORT_STORAGE_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

export function peekShareImportText(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(SHARE_IMPORT_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function clearShareImportText(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SHARE_IMPORT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Load shared text from sessionStorage and/or Cache API (service worker path). */
export async function consumeShareImportText(): Promise<string> {
  let text = peekShareImportText();
  if (text) {
    clearShareImportText();
    return text;
  }

  if (typeof caches === "undefined") return "";
  try {
    const cache = await caches.open(SHARE_IMPORT_CACHE);
    const res = await cache.match(SHARE_IMPORT_CACHE_URL);
    if (!res) return "";
    text = (await res.text()).trim();
    await cache.delete(SHARE_IMPORT_CACHE_URL);
    return text;
  } catch {
    return "";
  }
}
