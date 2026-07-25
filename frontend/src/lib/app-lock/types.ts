export const APP_LOCK_STORAGE_KEY = "pocketa-app-lock";
export const APP_LOCK_SESSION_KEY = "pocketa-app-lock-session";

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

export const GRACE_PERIOD_OPTIONS = [
  { value: 0, label: "فوری" },
  { value: 30, label: "۳۰ ثانیه" },
  { value: 60, label: "۱ دقیقه" },
  { value: 120, label: "۲ دقیقه" },
  { value: 300, label: "۵ دقیقه" },
] as const;

export type GracePeriodSec = (typeof GRACE_PERIOD_OPTIONS)[number]["value"];

export type AppLockPersisted = {
  enabled: boolean;
  pinSalt: string;
  pinHash: string;
  /** Digit count chosen at setup (4–6). */
  pinLength: number;
  biometricEnabled: boolean;
  /** Base64url credential id from WebAuthn platform authenticator */
  credentialId: string | null;
  gracePeriodSec: GracePeriodSec;
};

export type AppLockSession = {
  lastUnlockedAt: number;
  hiddenAt: number | null;
};

export const DEFAULT_APP_LOCK: AppLockPersisted = {
  enabled: false,
  pinSalt: "",
  pinHash: "",
  pinLength: 4,
  biometricEnabled: false,
  credentialId: null,
  gracePeriodSec: 30,
};
