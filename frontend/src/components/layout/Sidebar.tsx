"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import { useUiStore } from "@/stores/ui.store";
import { matchNavHref, SIDEBAR_NAV_ITEMS } from "./nav-items";

type Props = {
  onNavigate?: () => void;
  /** When true (e.g. Drawer), always show labels even if store is collapsed */
  forceExpanded?: boolean;
  /** Hide logo/brand (Drawer header already shows brand) */
  hideBrand?: boolean;
};

export function Sidebar({
  onNavigate,
  forceExpanded = false,
  hideBrand = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const storeCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const collapsed = forceExpanded ? false : storeCollapsed;

  const selectedKey = useMemo(() => {
    const match = SIDEBAR_NAV_ITEMS.find((it) => matchNavHref(pathname, it.href));
    return match?.href ?? "/dashboard";
  }, [pathname]);

  const menuItems: MenuProps["items"] = SIDEBAR_NAV_ITEMS.map((it) => ({
    key: it.href,
    icon: it.icon,
    label: <span data-tour={`nav-${it.key}`}>{it.label}</span>,
  }));

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden" data-tour="sidebar">
      {!hideBrand ? (
        <div className="px-4 py-5 flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className="flex items-center gap-3 min-w-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Pocketa"
              className="h-10 w-10 object-contain shrink-0"
            />
            {!collapsed ? (
              <div className="min-w-0">
                <Typography.Text strong className="!text-app-fg !text-base block truncate">
                  Pocketa
                </Typography.Text>
                <Typography.Text type="secondary" className="!text-xs">
                  مدیریت مالی شخصی
                </Typography.Text>
              </div>
            ) : null}
          </Link>
        </div>
      ) : null}

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        inlineCollapsed={collapsed}
        items={menuItems}
        className="!border-none !bg-transparent flex-1 min-h-0 max-sm:scroll-none overflow-y-auto overscroll-contain px-2"
        onClick={({ key }) => {
          router.push(String(key));
          onNavigate?.();
        }}
      />
    </div>
  );
}
