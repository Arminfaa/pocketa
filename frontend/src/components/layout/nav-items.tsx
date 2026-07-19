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
  SwapOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

export type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
  /** Custom active match; default: pathname starts with href base */
  match?: (pathname: string) => boolean;
};

const BOTTOM_PRIMARY_BASES = new Set(["/dashboard", "/transactions", "/reports"]);

/** Overflow destinations shown in the mobile «بیشتر» action sheet. */
export const MORE_NAV_ITEMS: NavItem[] = [
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
    key: "settings",
    href: "/settings",
    label: "تنظیمات",
    icon: <SettingOutlined />,
  },
  {
    key: "help",
    href: "/help",
    label: "راهنما",
    icon: <QuestionCircleOutlined />,
  },
].filter((it) => !BOTTOM_PRIMARY_BASES.has(it.href.split("?")[0] ?? it.href));

/** Quick-create destinations for the bottom-nav «+» action sheet. */
export const ADD_SHORTCUT_ITEMS: NavItem[] = [
  {
    key: "add-transaction",
    href: "/transactions?new=1",
    label: "تراکنش",
    icon: <TransactionOutlined />,
  },
  {
    key: "add-transfer",
    href: "/transactions?transfer=1",
    label: "انتقال وجه",
    icon: <SwapOutlined />,
  },
  {
    key: "add-import",
    href: "/imports/bank-sms",
    label: "ایمپورت بانکی",
    icon: <ImportOutlined />,
  },
  {
    key: "add-investment",
    href: "/investments?new=1",
    label: "سرمایه‌گذاری",
    icon: <FundOutlined />,
  },
  {
    key: "add-goal",
    href: "/goals?new=1",
    label: "هدف",
    icon: <AimOutlined />,
  },
  {
    key: "add-recurring",
    href: "/recurring?new=1",
    label: "سررسید / بدهی",
    icon: <AccountBookOutlined />,
  },
  {
    key: "add-account",
    href: "/accounts?new=1",
    label: "حساب بانکی",
    icon: <BankOutlined />,
  },
  {
    key: "add-category",
    href: "/categories?new=1",
    label: "دسته‌بندی",
    icon: <TagsOutlined />,
  },
  {
    key: "add-budget",
    href: "/budgets?new=1",
    label: "بودجه",
    icon: <WalletOutlined />,
  },
];

/** Primary mobile bottom tabs (5 slots). "add" / "more" open action sheets. */
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
    href: "#add",
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
  {
    key: "help",
    href: "/help",
    label: "راهنما",
    icon: <QuestionCircleOutlined />,
  },
];

export function matchNavHref(pathname: string | null, href: string): boolean {
  const base = href.split("?")[0] ?? href;
  if (!pathname || base.startsWith("#")) return false;
  if (base === "/dashboard") return pathname === "/dashboard";
  return pathname === base || pathname.startsWith(`${base}/`);
}
