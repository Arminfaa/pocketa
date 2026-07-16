"use client";

import { PropsWithChildren } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/stores/ui.store";
import { useThemeStore } from "@/stores/theme.store";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchAccounts } from "@/services/accounts";
import { LayoutGrid, SunMoon } from "lucide-react";
import { cn } from "@/lib/cn";

export default function AppLayout({ children }: PropsWithChildren) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountFilterStore((s) => s.setSelectedAccountId);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  return (
    <div className="min-h-screen flex bg-app">
      <Sidebar />

      <div className={cn("flex-1", collapsed ? "mr-0" : "mr-0")}>
        <header className="h-16 border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-10">
          <div className="h-full flex items-center justify-between px-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={toggleCollapse}
                className="h-10 w-10 rounded-2xl border border-[var(--border)] bg-transparent hover:bg-white/5 flex items-center justify-center shrink-0"
                aria-label="Toggle sidebar"
              >
                <LayoutGrid size={20} />
              </button>

              <select
                className="h-10 max-w-[220px] rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
                value={selectedAccountId ?? ""}
                onChange={(e) => setSelectedAccountId(e.target.value || null)}
                aria-label="فیلتر حساب بانکی"
              >
                <option value="">همه حساب‌ها</option>
                {(accountsQ.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.bankName ? ` · ${a.bankName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-2xl border border-[var(--border)] bg-transparent hover:bg-white/5 flex items-center justify-center shrink-0"
              aria-label="Toggle theme"
              title={mode === "dark" ? "حالت روشن" : "حالت تاریک"}
            >
              <SunMoon size={20} />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
