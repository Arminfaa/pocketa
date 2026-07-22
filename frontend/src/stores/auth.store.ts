"use client";

import { create } from "zustand";
import { useAccountFilterStore } from "@/stores/account-filter.store";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

const USER_CACHE_KEY = "pocketa-user-cache";

function readCachedUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    window.localStorage.removeItem("pocketa-access-token");
    const raw = window.sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.id && parsed?.email) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writeCachedUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) window.sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // ignore
  }
}

type AuthState = {
  user: AuthUser | null;
  hydrated: boolean;
  sessionChecked: boolean;

  hydrate: () => void;
  setUser: (user: AuthUser | null) => void;
  setSessionChecked: (checked: boolean) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  sessionChecked: false,

  hydrate: () => {
    // Restore last session user for instant shell while /me revalidates
    const user = readCachedUser();
    set({ hydrated: true, ...(user ? { user } : {}) });
  },

  setUser: (user) => {
    writeCachedUser(user);
    set({ user, hydrated: true });
  },

  setSessionChecked: (checked) => set({ sessionChecked: checked }),

  logout: () => {
    writeCachedUser(null);
    useAccountFilterStore.getState().setSelectedAccountId(null);
    set({ user: null, hydrated: true, sessionChecked: true });
  },
}));
