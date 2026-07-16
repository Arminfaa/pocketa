"use client";

import { create } from "zustand";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  loadingMe: boolean;

  hydrate: () => void;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;

  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  loadingMe: false,

  hydrate: () => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("pocketa-access-token") : null;
    set({
      accessToken: token,
      hydrated: true,
    });
  },

  setAccessToken: (token) => {
    if (typeof window !== "undefined") {
      if (token) window.localStorage.setItem("pocketa-access-token", token);
      else window.localStorage.removeItem("pocketa-access-token");
    }
    set({ accessToken: token });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("pocketa-access-token");
    }
    set({ accessToken: null, user: null, hydrated: true });
  },
}));

