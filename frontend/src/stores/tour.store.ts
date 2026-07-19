"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TourShell } from "@/features/tour/tour-steps";

export const TOUR_VERSION = 1;

type TourState = {
  /** User ids that should auto-start the tour after first login/register */
  pendingByUserId: Record<string, boolean>;
  /** userId -> completed tour version */
  completedByUserId: Record<string, number>;

  active: boolean;
  shell: TourShell | null;
  stepIndex: number;
  /** Ask AppLayout to open a sheet while the tour is running */
  sheetRequest: "more" | "add" | null;

  markPendingForUser: (userId: string) => void;
  clearPendingForUser: (userId: string) => void;
  isPendingForUser: (userId: string) => boolean;
  hasCompletedForUser: (userId: string) => boolean;

  startTour: (shell: TourShell) => void;
  setStepIndex: (index: number) => void;
  setSheetRequest: (sheet: "more" | "add" | null) => void;
  completeTour: (userId: string) => void;
  skipTour: (userId: string) => void;
  stopTour: () => void;
};

export const useTourStore = create<TourState>()(
  persist(
    (set, get) => ({
      pendingByUserId: {},
      completedByUserId: {},
      active: false,
      shell: null,
      stepIndex: 0,
      sheetRequest: null,

      markPendingForUser: (userId) =>
        set((s) => ({
          pendingByUserId: { ...s.pendingByUserId, [userId]: true },
        })),

      clearPendingForUser: (userId) =>
        set((s) => {
          const next = { ...s.pendingByUserId };
          delete next[userId];
          return { pendingByUserId: next };
        }),

      isPendingForUser: (userId) => Boolean(get().pendingByUserId[userId]),

      hasCompletedForUser: (userId) =>
        (get().completedByUserId[userId] ?? 0) >= TOUR_VERSION,

      startTour: (shell) =>
        set({
          active: true,
          shell,
          stepIndex: 0,
          sheetRequest: null,
        }),

      setStepIndex: (index) => set({ stepIndex: index }),

      setSheetRequest: (sheet) => set({ sheetRequest: sheet }),

      completeTour: (userId) =>
        set((s) => {
          const pending = { ...s.pendingByUserId };
          delete pending[userId];
          return {
            active: false,
            shell: null,
            stepIndex: 0,
            sheetRequest: null,
            pendingByUserId: pending,
            completedByUserId: {
              ...s.completedByUserId,
              [userId]: TOUR_VERSION,
            },
          };
        }),

      skipTour: (userId) => get().completeTour(userId),

      stopTour: () =>
        set({
          active: false,
          shell: null,
          stepIndex: 0,
          sheetRequest: null,
        }),
    }),
    {
      name: "pocketa-tour",
      partialize: (s) => ({
        pendingByUserId: s.pendingByUserId,
        completedByUserId: s.completedByUserId,
      }),
    }
  )
);
