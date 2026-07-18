import type { ReactNode } from "react";
import {
  DashboardOutlined,
  TransactionOutlined,
  ImportOutlined,
  FormOutlined,
  AccountBookOutlined,
  AimOutlined,
  FundOutlined,
  BankOutlined,
  TagsOutlined,
  WalletOutlined,
  PieChartOutlined,
  AppstoreOutlined,
  PlusCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** Custom active match; default: pathname starts with href base */
  match?: (pathname: string) => boolean;
};

/** Primary mobile bottom tabs (5 slots). "more" opens the overflow drawer. */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    key: "home",
    href: "/dashboard",
    label: "خانه",
    icon: <DashboardOutlined />,
    match: (p) => p === "/dashboard",
  },
  {
    key: "transactions",
    href: "/transactions",
    label: "تراکنش‌ها",
    icon: <TransactionOutlined />,
    match: (p) => p === "/transactions" || p.startsWith("/transactions/"),
  },
  {
    key: "add",
    href: "/transactions?new=1",
    label: "افزودن",
    icon: <PlusCircleOutlined />,
    match: () => false,
  },
  {
    key: "reports",
    href: "/reports",
    label: "گزارش‌ها",
    icon: <PieChartOutlined />,
  },
  {
    key: "more",
    href: "#more",
    label: "بیشتر",
    icon: <AppstoreOutlined />,
  },
];

/** Full sidebar / drawer menu (no quick-add entry). */
export const SIDEBAR_NAV_ITEMS: NavItem[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    label: "داشبورد",
    icon: <DashboardOutlined />,
    match: (p) => p === "/dashboard",
  },
  {
    key: "transactions",
    href: "/transactions",
    label: "تراکنش‌ها",
    icon: <TransactionOutlined />,
  },
  {
    key: "imports",
    href: "/imports/bank-sms",
    label: "ایمپورت پیامک",
    icon: <ImportOutlined />,
  },
  {
    key: "review",
    href: "/review",
    label: "نام‌گذاری",
    icon: <FormOutlined />,
  },
  {
    key: "recurring",
    href: "/recurring",
    label: "سررسید‌ها",
    icon: <AccountBookOutlined />,
  },
  {
    key: "investments",
    href: "/investments",
    label: "سرمایه‌گذاری",
    icon: <FundOutlined />,
  },
  {
    key: "goals",
    href: "/goals",
    label: "اهداف",
    icon: <AimOutlined />,
  },
  {
    key: "accounts",
    href: "/accounts",
    label: "حساب‌ها",
    icon: <BankOutlined />,
  },
  {
    key: "categories",
    href: "/categories",
    label: "دسته‌بندی‌ها",
    icon: <TagsOutlined />,
  },
  {
    key: "budgets",
    href: "/budgets",
    label: "بودجه",
    icon: <WalletOutlined />,
  },
  {
    key: "reports",
    href: "/reports",
    label: "گزارش‌ها",
    icon: <PieChartOutlined />,
  },
  {
    key: "settings",
    href: "/settings",
    label: "تنظیمات",
    icon: <SettingOutlined />,
  },
];

export function matchNavHref(pathname: string | null, href: string): boolean {
  const base = href.split("?")[0] ?? href;
  if (!pathname || base.startsWith("#")) return false;
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(`${base}/`);
}
