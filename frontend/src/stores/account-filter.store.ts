"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type AccountFilterState = {
  /** null = همه حساب‌ها */
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
};

export const useAccountFilterStore = create<AccountFilterState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      setSelectedAccountId: (id) => set({ selectedAccountId: id }),
    }),
    { name: "pocketa-account-filter" }
  )
);
