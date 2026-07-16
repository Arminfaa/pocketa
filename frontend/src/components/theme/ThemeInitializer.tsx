"use client";

import { useEffect } from "react";
import { useThemeStore, type ThemeMode } from "@/stores/theme.store";

export function ThemeInitializer() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("pocketa-theme") : null;
    const resolved: ThemeMode =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia?.("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    // Always sync DOM class on first load.
    setMode(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

