"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type GoalsMotivationDismissState = {
  /** Jalali YYYY/MM when the user dismissed the banner */
  dismissedMonth: string | null;
  dismissForMonth: (monthLabel: string) => void;
  isDismissedForMonth: (monthLabel: string) => boolean;
};

export const useGoalsMotivationDismissStore = create<GoalsMotivationDismissState>()(
  persist(
    (set, get) => ({
      dismissedMonth: null,
      dismissForMonth: (monthLabel) => set({ dismissedMonth: monthLabel }),
      isDismissedForMonth: (monthLabel) => get().dismissedMonth === monthLabel,
    }),
    {
      name: "pocketa-goals-motivation-dismiss",
      partialize: (s) => ({ dismissedMonth: s.dismissedMonth }),
    }
  )
);
