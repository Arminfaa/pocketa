import {
  APP_LOCK_SESSION_KEY,
  APP_LOCK_STORAGE_KEY,
  DEFAULT_APP_LOCK,
  type AppLockPersisted,
  type AppLockSession,
  type GracePeriodSec,
} from "@/lib/app-lock/types";

function isGracePeriod(value: unknown): value is GracePeriodSec {
  return value === 0 || value === 30 || value === 60 || value === 120 || value === 300;
}

export function readAppLockPersisted(): AppLockPersisted {
  if (typeof window === "undefined") return { ...DEFAULT_APP_LOCK };
  try {
    const raw = window.localStorage.getItem(APP_LOCK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_LOCK };
    const parsed = JSON.parse(raw) as Partial<AppLockPersisted>;
    const pinLength =
      typeof parsed.pinLength === "number" &&
      parsed.pinLength >= 4 &&
      parsed.pinLength <= 6
        ? parsed.pinLength
        : DEFAULT_APP_LOCK.pinLength;
    return {
      enabled: Boolean(parsed.enabled) && Boolean(parsed.pinSalt) && Boolean(parsed.pinHash),
      pinSalt: typeof parsed.pinSalt === "string" ? parsed.pinSalt : "",
      pinHash: typeof parsed.pinHash === "string" ? parsed.pinHash : "",
      pinLength,
      biometricEnabled: Boolean(parsed.biometricEnabled) && Boolean(parsed.credentialId),
      credentialId: typeof parsed.credentialId === "string" ? parsed.credentialId : null,
      gracePeriodSec: isGracePeriod(parsed.gracePeriodSec)
        ? parsed.gracePeriodSec
        : DEFAULT_APP_LOCK.gracePeriodSec,
    };
  } catch {
    return { ...DEFAULT_APP_LOCK };
  }
}

export function writeAppLockPersisted(data: AppLockPersisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

export function clearAppLockPersisted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(APP_LOCK_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readAppLockSession(): AppLockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(APP_LOCK_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AppLockSession>;
    if (typeof parsed.lastUnlockedAt !== "number") return null;
    return {
      lastUnlockedAt: parsed.lastUnlockedAt,
      hiddenAt: typeof parsed.hiddenAt === "number" ? parsed.hiddenAt : null,
    };
  } catch {
    return null;
  }
}

export function writeAppLockSession(session: AppLockSession): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(APP_LOCK_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearAppLockSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(APP_LOCK_SESSION_KEY);
  } catch {
    // ignore
  }
}
