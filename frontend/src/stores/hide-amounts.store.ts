"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Fixed-width mask so layout does not jump when amounts are hidden. */
export const HIDDEN_AMOUNT = "••••••••";

type HideAmountsState = {
  hideAmounts: boolean;
  setHideAmounts: (hide: boolean) => void;
  toggleHideAmounts: () => void;
};

export const useHideAmountsStore = create<HideAmountsState>()(
  persist(
    (set) => ({
      hideAmounts: false,
      setHideAmounts: (hide) => set({ hideAmounts: hide }),
      toggleHideAmounts: () => set((s) => ({ hideAmounts: !s.hideAmounts })),
    }),
    {
      name: "pocketa-hide-amounts",
      partialize: (s) => ({ hideAmounts: s.hideAmounts }),
    }
  )
);
