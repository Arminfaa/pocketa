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
  CalendarOutlined,
  AimOutlined,
  BankOutlined,
  TagsOutlined,
  WalletOutlined,
  PieChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useUiStore } from "@/stores/ui.store";

const items = [
  { href: "/dashboard", label: "داشبورد", icon: <DashboardOutlined /> },
  { href: "/transactions", label: "تراکنش‌ها", icon: <TransactionOutlined /> },
  { href: "/imports/bank-sms", label: "ایمپورت پیامک", icon: <ImportOutlined /> },
  { href: "/review", label: "نام‌گذاری", icon: <FormOutlined /> },
  { href: "/recurring", label: "تکرارشونده", icon: <CalendarOutlined /> },
  { href: "/goals", label: "اهداف پس‌انداز", icon: <AimOutlined /> },
  { href: "/accounts", label: "حساب‌های بانکی", icon: <BankOutlined /> },
  { href: "/categories", label: "دسته‌بندی‌ها", icon: <TagsOutlined /> },
  { href: "/budgets", label: "بودجه‌بندی", icon: <WalletOutlined /> },
  { href: "/reports", label: "گزارش‌ها", icon: <PieChartOutlined /> },
  { href: "/settings", label: "تنظیمات", icon: <SettingOutlined /> },
];

type Props = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

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
    <div className="h-full flex flex-col">
      <div className="px-4 py-4 flex items-center gap-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 min-w-0"
        >
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-brandViolet-500 flex items-center justify-center text-white font-bold shrink-0">
            P
          </div>
          {!collapsed ? (
            <Typography.Text strong className="!text-[var(--text)] truncate">
              Pocketa
            </Typography.Text>
          ) : null}
        </Link>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        inlineCollapsed={collapsed}
        items={menuItems}
        className="!border-none flex-1 overflow-y-auto"
        onClick={({ key }) => {
          router.push(String(key));
          onNavigate?.();
        }}
      />
    </div>
  );
}
