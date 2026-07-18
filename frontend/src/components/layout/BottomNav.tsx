"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusOutlined } from "@ant-design/icons";
import { BOTTOM_NAV_ITEMS, type NavItem } from "./nav-items";
import { cn } from "@/lib/cn";

interface BottomNavProps {
  onMore?: () => void;
  moreOpen?: boolean;
  onAdd?: () => void;
  addOpen?: boolean;
  onHeightChange?: (height: number) => void;
}

function isItemActive(
  pathname: string,
  item: NavItem,
  moreOpen?: boolean,
  addOpen?: boolean
) {
  if (item.key === "more") return Boolean(moreOpen);
  if (item.key === "add") return Boolean(addOpen);
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomNav({
  onMore,
  moreOpen,
  onAdd,
  addOpen,
  onHeightChange,
}: BottomNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const publish = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      onHeightChange?.(height);
      document.documentElement.style.setProperty("--bottom-nav-height", `${height}px`);
    };

    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    ro?.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", publish);
    };
  }, [onHeightChange]);

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="ناوبری اصلی"
    >
      {/* Top pad = half FAB so the raised button isn't clipped */}
      <div className="mx-auto max-w-lg px-3 pb-1.5 pt-7">
        <div className="relative flex h-[3.25rem] items-center justify-between gap-0.5 rounded-[1.6rem] border border-[color-mix(in_srgb,var(--muted)_22%,transparent)] bg-app-card/95 px-1.5 shadow-soft backdrop-blur-xl dark:border-[color-mix(in_srgb,var(--muted)_32%,transparent)]">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item, moreOpen, addOpen);

            if (item.key === "add") {
              return (
                <div
                  key={item.key}
                  className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end pb-1"
                >
                  <button
                    type="button"
                    onClick={onAdd}
                    aria-label={item.label}
                    aria-expanded={addOpen}
                    className={cn(
                      "absolute left-1/2 top-0 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2",
                      "items-center justify-center rounded-full text-white",
                      "transition-transform duration-200",
                      "bg-gradient-to-br from-cyan-400 via-cyan-500 to-violet-500",
                      "shadow-[0_8px_22px_rgba(6,182,212,0.45)]",
                      "ring-[3px] ring-[color-mix(in_srgb,var(--card)_92%,transparent)]",
                      "active:scale-95",
                      addOpen && "scale-105 shadow-[0_10px_28px_rgba(6,182,212,0.55)]"
                    )}
                  >
                    <PlusOutlined
                      className={cn(
                        "text-[1.4rem] leading-none transition-transform duration-200",
                        addOpen && "rotate-45"
                      )}
                    />
                  </button>
                  <span
                    className={cn(
                      "truncate text-[10px] font-medium leading-none",
                      addOpen
                        ? "text-brand-600 dark:text-brand-300"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              );
            }

            const className = cn(
              "flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-all",
              active
                ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"
                : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
            );

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
                  <span className={cn("text-lg leading-none", active ? "scale-105" : "opacity-80")}>
                    {item.icon}
                  </span>
                  <span className="truncate text-[10px] font-medium leading-none">{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.key} href={item.href} className={className} aria-label={item.label}>
                <span
                  className={cn(
                    "leading-none",
                    active ? "scale-105 text-lg" : "text-lg opacity-80"
                  )}
                >
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
