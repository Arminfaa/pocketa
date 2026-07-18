"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_QUICK_ACCESS_KEYS,
  sanitizeQuickAccessKeys,
  type QuickAccessKey,
} from "@/lib/quick-access";

type QuickAccessState = {
  keys: QuickAccessKey[];
  setKeys: (keys: QuickAccessKey[]) => void;
};

export const useQuickAccessStore = create<QuickAccessState>()(
  persist(
    (set) => ({
      keys: [...DEFAULT_QUICK_ACCESS_KEYS],
      setKeys: (keys) => set({ keys: sanitizeQuickAccessKeys(keys) }),
    }),
    {
      name: "pocketa-quick-access",
      partialize: (s) => ({ keys: s.keys }),
      merge: (persisted, current) => {
        const p = persisted as { keys?: unknown } | undefined;
        return {
          ...current,
          keys: sanitizeQuickAccessKeys(p?.keys ?? current.keys),
        };
      },
    }
  )
);
