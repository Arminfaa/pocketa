"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  TransactionOutlined,
  ImportOutlined,
  FormOutlined,
  AccountBookOutlined,
  AimOutlined,
  BankOutlined,
  TagsOutlined,
  WalletOutlined,
  PieChartOutlined,
  SettingOutlined,
  GoldOutlined,
} from "@ant-design/icons";
import { useUiStore } from "@/stores/ui.store";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: <DashboardOutlined /> },
  { href: "/transactions", label: "تراکنش‌ها", icon: <TransactionOutlined /> },
  { href: "/imports/bank-sms", label: "ایمپورت پیامک", icon: <ImportOutlined /> },
  { href: "/review", label: "نام‌گذاری", icon: <FormOutlined /> },
  { href: "/recurring", label: "بدهی / اقساط", icon: <AccountBookOutlined /> },
  { href: "/goals", label: "اهداف پس‌انداز", icon: <AimOutlined /> },
  { href: "/accounts", label: "حساب‌های بانکی", icon: <BankOutlined /> },
  { href: "/categories", label: "دسته‌بندی‌ها", icon: <TagsOutlined /> },
  { href: "/budgets", label: "بودجه‌بندی", icon: <WalletOutlined /> },
  { href: "/reports", label: "گزارش‌ها", icon: <PieChartOutlined /> },
  { href: "/gold-calculator", label: "محاسبه‌گر طلا/دلار", icon: <GoldOutlined /> },
  { href: "/settings", label: "تنظیمات", icon: <SettingOutlined /> },
];

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
    const match = items.find(
      (it) => pathname === it.href || pathname?.startsWith(`${it.href}/`)
    );
    return match?.href ?? "/dashboard";
  }, [pathname]);

  const menuItems: MenuProps["items"] = items.map((it) => ({
    key: it.href,
    icon: it.icon,
    label: it.label,
  }));

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {!hideBrand ? (
        <div className="px-4 py-4 flex items-center gap-3 shrink-0">
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
              <Typography.Text strong className="!text-app-fg truncate">
                Pocketa
              </Typography.Text>
            ) : null}
          </Link>
        </div>
      ) : null}

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        inlineCollapsed={collapsed}
        items={menuItems}
        className="!border-none !bg-transparent flex-1 min-h-0 max-sm:scroll-none overflow-y-auto overscroll-contain"
        onClick={({ key }) => {
          router.push(String(key));
          onNavigate?.();
        }}
      />
    </div>
  );
}
