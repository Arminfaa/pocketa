"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_NAV_ITEMS, type NavItem } from "./nav-items";

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
      <div className="mx-auto max-w-lg px-3 pb-2.5 pt-1.5">
        <div className="flex items-stretch justify-between gap-1 rounded-[1.85rem] border border-[color-mix(in_srgb,var(--muted)_22%,transparent)] bg-app-card/95 px-2 py-2 shadow-soft backdrop-blur-xl dark:border-[color-mix(in_srgb,var(--muted)_32%,transparent)]">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const active = isItemActive(pathname, item, moreOpen, addOpen);
            const className = [
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 transition-all",
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
                  <span className={`text-xl leading-none ${active ? "scale-105" : "opacity-80"}`}>
                    {item.icon}
                  </span>
                  <span className="truncate text-[11px] font-medium leading-none">{item.label}</span>
                </button>
              );
            }

            if (item.key === "add") {
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={onAdd}
                  className={className}
                  aria-label={item.label}
                  aria-expanded={addOpen}
                >
                  <span
                    className={`leading-none ${
                      active || addOpen ? "scale-105 text-[1.35rem]" : "text-xl opacity-90"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate text-[11px] font-medium leading-none">{item.label}</span>
                </button>
              );
            }

            return (
              <Link key={item.key} href={item.href} className={className} aria-label={item.label}>
                <span
                  className={`leading-none ${
                    active ? "scale-105 text-[1.35rem]" : "text-xl opacity-80"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
