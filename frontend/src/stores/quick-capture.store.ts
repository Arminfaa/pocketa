"use client";

import { create } from "zustand";

type QuickCaptureState = {
  open: boolean;
  openQuickCapture: () => void;
  closeQuickCapture: () => void;
};

export const useQuickCaptureStore = create<QuickCaptureState>((set) => ({
  open: false,
  openQuickCapture: () => set({ open: true }),
  closeQuickCapture: () => set({ open: false }),
}));
