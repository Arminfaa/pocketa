"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Wallet,
  PieChart,
  Settings,
  Tags,
  Landmark,
  FileInput,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui.store";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/transactions", label: "تراکنش‌ها", icon: ReceiptText },
  { href: "/imports/bank-sms", label: "ایمپورت پیامک", icon: FileInput },
  { href: "/review", label: "نام‌گذاری", icon: ClipboardCheck },
  { href: "/accounts", label: "حساب‌های بانکی", icon: Landmark },
  { href: "/categories", label: "دسته‌بندی‌ها", icon: Tags },
  { href: "/budgets", label: "بودجه‌بندی", icon: Wallet },
  { href: "/reports", label: "گزارش‌ها", icon: PieChart },
  { href: "/settings", label: "تنظیمات", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <aside
      className={cn(
        "h-[calc(100vh-0px)] sticky top-0 border-l border-[var(--border)] bg-[var(--card)]",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-brandViolet-500 flex items-center justify-center text-white font-bold">
            P
          </div>
          {!collapsed ? <div className="text-sm font-semibold">Pocketa</div> : null}
        </div>
      </div>

      <nav className="px-2 pb-4">
        {items.map((it) => {
          const Icon = it.icon;
          const active = pathname === it.href || pathname?.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 mb-1 transition-colors",
                active ? "bg-brand-500/12 text-brand-500" : "hover:bg-white/5 text-[var(--text)]"
              )}
            >
              <Icon size={20} />
              {!collapsed ? <span className="text-sm font-medium">{it.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
