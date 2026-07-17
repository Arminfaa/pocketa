"use client";

import { create } from "zustand";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("pocketa-access-token");
    }
    set({ hydrated: true });
  },

  setUser: (user) => set({ user, hydrated: true }),

  setSessionChecked: (checked) => set({ sessionChecked: checked }),

  logout: () => {
    set({ user: null, hydrated: true, sessionChecked: true });
  },
}));
