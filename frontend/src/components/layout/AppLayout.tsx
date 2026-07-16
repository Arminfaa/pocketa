"use client";

import { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/stores/ui.store";
import { useThemeStore } from "@/stores/theme.store";
import { LayoutGrid, SunMoon } from "lucide-react";
import { cn } from "@/lib/cn";

export default function AppLayout({ children }: PropsWithChildren) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);

  return (
    <div className="min-h-screen flex bg-app">
      <Sidebar />

      <div className={cn("flex-1", collapsed ? "mr-0" : "mr-0")}>
        <header className="h-16 border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-10">
          <div className="h-full flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleCollapse}
                className="h-10 w-10 rounded-2xl border border-[var(--border)] bg-transparent hover:bg-white/5 flex items-center justify-center"
                aria-label="Toggle sidebar"
              >
                <LayoutGrid size={20} />
              </button>
              <div className="text-sm text-[var(--muted)]">پنل کاربری</div>
            </div>

            <button
              onClick={toggleTheme}
              className="h-10 w-10 rounded-2xl border border-[var(--border)] bg-transparent hover:bg-white/5 flex items-center justify-center"
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

