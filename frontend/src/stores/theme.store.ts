"use client";

import { create } from "zustand";

export type ThemeMode = "light" | "dark";

type ThemeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  setMode: (mode) => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", mode === "dark");
      localStorage.setItem("pocketa-theme", mode);
    }
    set({ mode });
  },
  toggle: () =>
    set((s) => {
      const next: ThemeMode = s.mode === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
        localStorage.setItem("pocketa-theme", next);
      }
      return { mode: next };
    }),
}));

