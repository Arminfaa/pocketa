"use client";

import { PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Button, Flex, Grid, Layout, Select, Typography } from "antd";
import { cn } from "@/lib/cn";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MoreActionSheet } from "./MoreActionSheet";
import { AddActionSheet } from "./AddActionSheet";
import { useUiStore } from "@/stores/ui.store";
import { useThemeStore } from "@/stores/theme.store";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { useAuthStore } from "@/stores/auth.store";
import { useTourStore } from "@/stores/tour.store";
import { fetchAccounts } from "@/services/accounts";
import api from "@/services/api";
import { PageMotion } from "@/components/ui/page-motion";
import { OnboardingTour } from "@/features/tour/OnboardingTour";
import { useHideOnSoftKeyboard } from "@/hooks/use-hide-on-soft-keyboard";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { OfflineBannerContent } from "@/features/offline/OfflineBannerContent";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

const DEFAULT_BOTTOM_NAV_HEIGHT = 88;

export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  /** Below Ant Design `lg` (~992px): bottom nav + more action sheet */
  const shellReady = screens.lg !== undefined;
  const isMobileShell = !screens.lg;
  const tourActive = useTourStore((s) => s.active);

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountFilterStore((s) => s.setSelectedAccountId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [bottomNavHeight, setBottomNavHeight] = useState(DEFAULT_BOTTOM_NAV_HEIGHT);
  const hideBottomNavForKeyboard = useHideOnSoftKeyboard();
  const online = useOnlineStatus();

  const requestMore = useCallback((open: boolean) => {
    setMoreOpen(open);
    if (open) setAddOpen(false);
  }, []);
  const requestAdd = useCallback((open: boolean) => {
    setAddOpen(open);
    if (open) setMoreOpen(false);
  }, []);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isMobileShell) {
      setMoreOpen(false);
      setAddOpen(false);
      document.documentElement.style.removeProperty("--bottom-nav-height");
    }
  }, [isMobileShell]);

  useEffect(() => {
    // Keep sheets open when the onboarding tour is driving them across routes
    if (tourActive) return;
    setMoreOpen(false);
    setAddOpen(false);
  }, [pathname, tourActive]);

  useEffect(() => {
    if (!online) setMoreOpen(false);
  }, [online]);

  const onBottomNavHeightChange = useCallback((height: number) => {
    if (height > 0) setBottomNavHeight(height);
  }, []);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore — clear local session anyway
    } finally {
      logout();
      message.success("خارج شدید");
      router.replace("/login");
      setLoggingOut(false);
      setMoreOpen(false);
      setAddOpen(false);
    }
  }

  return (
    <Layout className="h-dvh max-h-dvh !bg-transparent overflow-hidden">
      {!isMobileShell ? (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={268}
          collapsedWidth={80}
          className="!h-dvh !max-h-dvh shrink-0 overflow-hidden !border-0 bg-app-card/90 shadow-soft"
        >
          <Sidebar />
        </Sider>
      ) : null}

      {isMobileShell ? (
        <>
          <MoreActionSheet
            open={moreOpen}
            onClose={() => setMoreOpen(false)}
            mode={mode}
            onToggleTheme={toggleTheme}
            onLogout={onLogout}
            loggingOut={loggingOut}
          />
          <AddActionSheet open={addOpen} onClose={() => setAddOpen(false)} />
        </>
      ) : null}

      <Layout className="!bg-transparent min-w-0 max-w-full flex-1 h-dvh max-h-dvh overflow-hidden flex flex-col">
        <Header
          className={cn(
            "shrink-0 !h-auto !leading-normal !px-3 sm:!px-5 !py-3 z-20",
            "border-0 border-b border-solid",
            "border-[color-mix(in_srgb,var(--muted)_16%,transparent)]",
            "dark:border-[color-mix(in_srgb,var(--muted)_28%,transparent)]",
            "bg-app-card/70 backdrop-blur-md"
          )}
        >
          {isMobileShell ? (
            <Flex vertical gap={10} className="w-full">
              <Flex align="center" justify="space-between" gap={8}>
                <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Pocketa" className="h-9 w-9 object-contain" />
                  <div className="min-w-0">
                    <Text strong className="!text-app-fg !text-base block leading-tight">
                      Pocketa
                    </Text>
                    <Text type="secondary" className="!text-xs block truncate">
                      {user?.name ? `سلام ${user.name}` : "مدیریت مالی شخصی"}
                    </Text>
                  </div>
                </Link>
                <Flex align="center" gap={8} className="shrink-0">
                  {!online ? <OfflineBannerContent compact /> : null}
                  {online ? (
                    <Link href="/help" aria-label="راهنما">
                      <Button
                        type="text"
                        shape="circle"
                        className="!bg-brand-500/10 !text-brand-600"
                        icon={<QuestionCircleOutlined />}
                        aria-label="راهنما"
                      />
                    </Link>
                  ) : (
                    <Button
                      type="text"
                      shape="circle"
                      disabled
                      className="!bg-brand-500/10 !text-brand-600"
                      icon={<QuestionCircleOutlined />}
                      aria-label="راهنما"
                      title="در حالت آفلاین در دسترس نیست"
                    />
                  )}
                  <Button
                    type="text"
                    shape="circle"
                    className="!bg-brand-500/10 !text-brand-600"
                    icon={<BulbOutlined />}
                    onClick={toggleTheme}
                    aria-label="تغییر تم"
                    data-tour="theme-toggle"
                  />
                </Flex>
              </Flex>
              <div data-tour="account-filter" className="w-full">
                <Select
                  allowClear
                  placeholder="همه حساب‌ها"
                  className="w-full"
                  value={selectedAccountId ?? undefined}
                  onChange={(v) => setSelectedAccountId(v ?? null)}
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.bankName ? `${a.name} · ${a.bankName}` : a.name,
                  }))}
                  loading={accountsQ.isLoading}
                />
              </div>
            </Flex>
          ) : (
            <Flex align="center" gap={10} wrap="wrap" className="w-full">
              <Button
                type="default"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapse}
                aria-label="جمع کردن سایدبار"
                data-tour="sidebar-collapse"
              />
              <div data-tour="account-filter" className="min-w-44 max-w-64 flex-1">
                <Select
                  allowClear
                  placeholder="همه حساب‌ها"
                  className="w-full"
                  value={selectedAccountId ?? undefined}
                  onChange={(v) => setSelectedAccountId(v ?? null)}
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.bankName ? `${a.name} · ${a.bankName}` : a.name,
                  }))}
                  loading={accountsQ.isLoading}
                  popupMatchSelectWidth={false}
                />
              </div>
              <Flex align="center" gap={8} className="!ms-auto shrink-0">
                {!online ? <OfflineBannerContent compact /> : null}
                {online ? (
                  <Link href="/help" aria-label="راهنما">
                    <Button
                      type="default"
                      icon={<QuestionCircleOutlined />}
                      aria-label="راهنما"
                    />
                  </Link>
                ) : (
                  <Button
                    type="default"
                    disabled
                    icon={<QuestionCircleOutlined />}
                    aria-label="راهنما"
                    title="در حالت آفلاین در دسترس نیست"
                  />
                )}
                <Button
                  type="default"
                  icon={<BulbOutlined />}
                  onClick={toggleTheme}
                  aria-label="تغییر تم"
                  data-tour="theme-toggle"
                />
                <Button
                  type="default"
                  icon={<LogoutOutlined />}
                  onClick={onLogout}
                  loading={loggingOut}
                  disabled={!online}
                  aria-label="خروج از حساب"
                />
              </Flex>
            </Flex>
          )}
        </Header>

        <Content
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 overscroll-y-contain",
            isMobileShell && "transition-[padding-bottom] duration-200 ease-out"
          )}
          style={
            isMobileShell
              ? {
                  paddingBottom: hideBottomNavForKeyboard
                    ? "0.75rem"
                    : `calc(${bottomNavHeight}px + 0.75rem)`,
                }
              : undefined
          }
        >
          <PageMotion key={pathname}>{children}</PageMotion>
        </Content>

        {isMobileShell ? (
          <BottomNav
            moreOpen={moreOpen}
            onMore={() => {
              if (tourActive) return;
              setAddOpen(false);
              setMoreOpen((open) => !open);
            }}
            addOpen={addOpen}
            onAdd={() => {
              if (tourActive) return;
              setMoreOpen(false);
              setAddOpen((open) => !open);
            }}
            onHeightChange={onBottomNavHeightChange}
            hideForKeyboard={hideBottomNavForKeyboard}
          />
        ) : null}
      </Layout>

      <OnboardingTour
        isMobileShell={isMobileShell}
        shellReady={shellReady}
        onRequestMore={requestMore}
        onRequestAdd={requestAdd}
      />
    </Layout>
  );
}
