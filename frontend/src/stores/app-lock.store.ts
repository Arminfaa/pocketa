"use client";

import { create } from "zustand";
import { createPinRecord, isValidPinFormat, verifyPin } from "@/lib/app-lock/crypto";
import {
  clearAppLockPersisted,
  clearAppLockSession,
  readAppLockPersisted,
  readAppLockSession,
  writeAppLockPersisted,
  writeAppLockSession,
} from "@/lib/app-lock/storage";
import {
  DEFAULT_APP_LOCK,
  type AppLockPersisted,
  type GracePeriodSec,
} from "@/lib/app-lock/types";
import {
  assertBiometricCredential,
  enrollBiometricCredential,
  isPlatformAuthenticatorAvailable,
  webAuthnErrorMessage,
} from "@/lib/app-lock/webauthn";

const MAX_ATTEMPTS_BEFORE_LOCKOUT = 5;
const LOCKOUT_MS = 30_000;

type AppLockState = AppLockPersisted & {
  hydrated: boolean;
  locked: boolean;
  failedAttempts: number;
  lockoutUntil: number | null;
  biometricAvailable: boolean;

  hydrate: () => void;
  markHidden: () => void;
  evaluateVisibility: () => void;
  unlockWithPin: (pin: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  unlockWithBiometric: () => Promise<{ ok: true } | { ok: false; error: string }>;
  enableWithPin: (pin: string) => Promise<void>;
  changePin: (currentPin: string, nextPin: string) => Promise<void>;
  disable: (pin: string) => Promise<void>;
  setGracePeriod: (sec: GracePeriodSec) => void;
  enableBiometric: (userId: string, pin: string) => Promise<void>;
  disableBiometric: (pin: string) => Promise<void>;
  /** Force lock (e.g. manual lock from settings). */
  lockNow: () => void;
  /** On account logout — keep device PIN, but require unlock next time. */
  onLogout: () => void;
};

function persist(partial: AppLockPersisted) {
  writeAppLockPersisted(partial);
}

function sessionUnlocked(now = Date.now()) {
  writeAppLockSession({ lastUnlockedAt: now, hiddenAt: null });
}

function clearUnlockSession() {
  clearAppLockSession();
}

/** Full page load / PWA cold start always requires unlock when enabled. */
function shouldStartLocked(persisted: AppLockPersisted): boolean {
  return persisted.enabled;
}

export const useAppLockStore = create<AppLockState>((set, get) => ({
  ...DEFAULT_APP_LOCK,
  hydrated: false,
  locked: true,
  failedAttempts: 0,
  lockoutUntil: null,
  biometricAvailable: false,

  hydrate: () => {
    const persisted = readAppLockPersisted();
    const locked = shouldStartLocked(persisted);
    if (locked) clearUnlockSession();
    set({
      ...persisted,
      hydrated: true,
      locked,
      failedAttempts: 0,
      lockoutUntil: null,
    });
    void isPlatformAuthenticatorAvailable().then((biometricAvailable) => {
      set({ biometricAvailable });
    });
  },

  markHidden: () => {
    const { enabled, locked } = get();
    if (!enabled || locked) return;
    const session = readAppLockSession() ?? {
      lastUnlockedAt: Date.now(),
      hiddenAt: null,
    };
    writeAppLockSession({ ...session, hiddenAt: Date.now() });
  },

  evaluateVisibility: () => {
    const { enabled, gracePeriodSec, locked } = get();
    if (!enabled || locked) return;
    const session = readAppLockSession();
    if (!session?.hiddenAt) return;
    const elapsed = Date.now() - session.hiddenAt;
    if (elapsed >= gracePeriodSec * 1000) {
      clearUnlockSession();
      set({ locked: true, failedAttempts: 0, lockoutUntil: null });
    } else {
      writeAppLockSession({ ...session, hiddenAt: null });
    }
  },

  unlockWithPin: async (pin) => {
    const state = get();
    if (!state.enabled) return { ok: true };
    if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
      const sec = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
      return { ok: false, error: `لطفاً ${sec} ثانیه صبر کنید` };
    }
    if (!isValidPinFormat(pin)) {
      return { ok: false, error: "پین باید ۴ تا ۶ رقم باشد" };
    }

    const ok = await verifyPin(pin, state.pinSalt, state.pinHash);
    if (!ok) {
      const failedAttempts = state.failedAttempts + 1;
      if (failedAttempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
        const lockoutUntil = Date.now() + LOCKOUT_MS;
        set({ failedAttempts: 0, lockoutUntil });
        return { ok: false, error: "پین اشتباه — ۳۰ ثانیه قفل موقت" };
      }
      set({ failedAttempts });
      return {
        ok: false,
        error: `پین اشتباه (${failedAttempts} از ${MAX_ATTEMPTS_BEFORE_LOCKOUT})`,
      };
    }

    sessionUnlocked();
    set({ locked: false, failedAttempts: 0, lockoutUntil: null });
    return { ok: true };
  },

  unlockWithBiometric: async () => {
    const state = get();
    if (!state.enabled) return { ok: true };
    if (!state.biometricEnabled || !state.credentialId) {
      return { ok: false, error: "بیومتریک فعال نیست" };
    }
    if (state.lockoutUntil && Date.now() < state.lockoutUntil) {
      const sec = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
      return { ok: false, error: `لطفاً ${sec} ثانیه صبر کنید` };
    }
    try {
      await assertBiometricCredential(state.credentialId);
      sessionUnlocked();
      set({ locked: false, failedAttempts: 0, lockoutUntil: null });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: webAuthnErrorMessage(err, "باز کردن با بیومتریک ناموفق بود") };
    }
  },

  enableWithPin: async (pin) => {
    if (!isValidPinFormat(pin)) {
      throw new Error("پین باید ۴ تا ۶ رقم باشد");
    }
    const { salt, hash } = await createPinRecord(pin);
    const next: AppLockPersisted = {
      enabled: true,
      pinSalt: salt,
      pinHash: hash,
      pinLength: pin.length,
      biometricEnabled: false,
      credentialId: null,
      gracePeriodSec: get().gracePeriodSec || DEFAULT_APP_LOCK.gracePeriodSec,
    };
    persist(next);
    sessionUnlocked();
    set({
      ...next,
      locked: false,
      failedAttempts: 0,
      lockoutUntil: null,
    });
  },

  changePin: async (currentPin, nextPin) => {
    const state = get();
    if (!state.enabled) throw new Error("قفل اپ فعال نیست");
    if (!isValidPinFormat(nextPin)) throw new Error("پین جدید باید ۴ تا ۶ رقم باشد");
    const ok = await verifyPin(currentPin, state.pinSalt, state.pinHash);
    if (!ok) throw new Error("پین فعلی اشتباه است");
    const { salt, hash } = await createPinRecord(nextPin);
    const next: AppLockPersisted = {
      enabled: state.enabled,
      pinSalt: salt,
      pinHash: hash,
      pinLength: nextPin.length,
      biometricEnabled: state.biometricEnabled,
      credentialId: state.credentialId,
      gracePeriodSec: state.gracePeriodSec,
    };
    persist(next);
    set({ pinSalt: salt, pinHash: hash, pinLength: nextPin.length });
  },

  disable: async (pin) => {
    const state = get();
    if (!state.enabled) return;
    const ok = await verifyPin(pin, state.pinSalt, state.pinHash);
    if (!ok) throw new Error("پین اشتباه است");
    clearAppLockPersisted();
    clearUnlockSession();
    set({
      ...DEFAULT_APP_LOCK,
      gracePeriodSec: state.gracePeriodSec,
      hydrated: true,
      locked: false,
      failedAttempts: 0,
      lockoutUntil: null,
      biometricAvailable: state.biometricAvailable,
    });
  },

  setGracePeriod: (sec) => {
    const state = get();
    const next: AppLockPersisted = {
      enabled: state.enabled,
      pinSalt: state.pinSalt,
      pinHash: state.pinHash,
      pinLength: state.pinLength,
      biometricEnabled: state.biometricEnabled,
      credentialId: state.credentialId,
      gracePeriodSec: sec,
    };
    if (state.enabled) persist(next);
    set({ gracePeriodSec: sec });
  },

  enableBiometric: async (userId, pin) => {
    const state = get();
    if (!state.enabled) throw new Error("ابتدا قفل اپ را با پین فعال کنید");
    const ok = await verifyPin(pin, state.pinSalt, state.pinHash);
    if (!ok) throw new Error("پین اشتباه است");
    if (!(await isPlatformAuthenticatorAvailable())) {
      throw new Error("بیومتریک روی این دستگاه در دسترس نیست");
    }
    const credentialId = await enrollBiometricCredential(userId);
    const next: AppLockPersisted = {
      enabled: true,
      pinSalt: state.pinSalt,
      pinHash: state.pinHash,
      pinLength: state.pinLength,
      biometricEnabled: true,
      credentialId,
      gracePeriodSec: state.gracePeriodSec,
    };
    persist(next);
    set({ biometricEnabled: true, credentialId, biometricAvailable: true });
  },

  disableBiometric: async (pin) => {
    const state = get();
    if (!state.enabled) return;
    const ok = await verifyPin(pin, state.pinSalt, state.pinHash);
    if (!ok) throw new Error("پین اشتباه است");
    const next: AppLockPersisted = {
      enabled: true,
      pinSalt: state.pinSalt,
      pinHash: state.pinHash,
      pinLength: state.pinLength,
      biometricEnabled: false,
      credentialId: null,
      gracePeriodSec: state.gracePeriodSec,
    };
    persist(next);
    set({ biometricEnabled: false, credentialId: null });
  },

  lockNow: () => {
    if (!get().enabled) return;
    clearUnlockSession();
    set({ locked: true, failedAttempts: 0, lockoutUntil: null });
  },

  onLogout: () => {
    clearUnlockSession();
    const state = get();
    if (state.enabled) {
      set({ locked: true, failedAttempts: 0, lockoutUntil: null });
    }
  },
}));
