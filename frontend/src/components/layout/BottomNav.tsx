"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS, type NavItem } from "./nav-items";

interface BottomNavProps {
  onMore?: () => void;
  moreOpen?: boolean;
}

function isItemActive(pathname: string, item: NavItem, moreOpen?: boolean) {
  if (item.key === "more") return Boolean(moreOpen);
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNav({ onMore, moreOpen }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="ناوبری اصلی"
    >
      <div className="mx-auto max-w-lg px-3 pb-2 pt-1">
        <div className="flex items-stretch justify-between gap-0.5 rounded-[1.75rem] border border-white/70 bg-white/95 px-1.5 py-1.5 shadow-[0_10px_40px_rgba(37,99,235,0.12)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/95">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item, moreOpen);
            const className = [
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition-all",
              active
                ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
              item.key === "add" ? "text-brand-600 dark:text-brand-300" : "",
            ].join(" ");

            if (item.key === "more") {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={onMore}
                  className={className}
                  aria-label={item.label}
                  aria-expanded={moreOpen}
                >
                  <span className={active ? "scale-105" : "opacity-80"}>{item.icon}</span>
                  <span className="truncate text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.key} href={item.href} className={className} aria-label={item.label}>
                <span className={item.key === "add" || active ? "scale-105 text-lg leading-none" : "opacity-80"}>
                  {item.icon}
                </span>
                <span className="truncate text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
