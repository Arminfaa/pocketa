"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { App, Button, Drawer, Flex, Grid, Layout, Select, Typography } from "antd";
import { cn } from "@/lib/cn";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { useUiStore } from "@/stores/ui.store";
import { useThemeStore } from "@/stores/theme.store";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { useAuthStore } from "@/stores/auth.store";
import { fetchAccounts } from "@/services/accounts";
import api from "@/services/api";
import { PageMotion } from "@/components/ui/page-motion";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;
const { Text } = Typography;

export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const screens = useBreakpoint();
  /** Below Ant Design `lg` (~992px): bottom nav + overflow drawer */
  const isMobileShell = !screens.lg;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountFilterStore((s) => s.setSelectedAccountId);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!isMobileShell) setDrawerOpen(false);
  }, [isMobileShell]);

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

      <Drawer
        placement="right"
        open={isMobileShell && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size={300}
        classNames={{
          body: "!p-0 !bg-app-card",
          header: "!border-0 !bg-app-card",
        }}
        title={
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Pocketa" className="h-8 w-8 object-contain shrink-0" />
            <span className="font-semibold text-app-fg truncate">Pocketa</span>
          </div>
        }
        destroyOnHidden
      >
        <Sidebar forceExpanded hideBrand onNavigate={() => setDrawerOpen(false)} />
        <div className="bg-brand-500/[0.04] p-3 flex gap-2">
          <Button
            block
            icon={<BulbOutlined />}
            onClick={toggleTheme}
          >
            {mode === "dark" ? "حالت روشن" : "حالت تاریک"}
          </Button>
          <Button
            block
            danger
            icon={<LogoutOutlined />}
            onClick={onLogout}
            loading={loggingOut}
          >
            خروج
          </Button>
        </div>
      </Drawer>

      <Layout className="!bg-transparent min-w-0 max-w-full flex-1 h-dvh max-h-dvh overflow-hidden flex flex-col">
        <Header
          className={cn(
            "shrink-0 !h-auto !leading-normal !px-3 sm:!px-5 !py-3 z-20",
            "!border-0 bg-app-card/70 backdrop-blur-md"
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
                <Button
                  type="text"
                  shape="circle"
                  className="!bg-brand-500/10 !text-brand-600"
                  icon={<BulbOutlined />}
                  onClick={toggleTheme}
                  aria-label="تغییر تم"
                />
              </Flex>
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
            </Flex>
          ) : (
            <Flex align="center" gap={10} wrap="wrap" className="w-full">
              <Button
                type="default"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapse}
                aria-label="جمع کردن سایدبار"
              />
              <Select
                allowClear
                placeholder="همه حساب‌ها"
                className="min-w-44 max-w-64 flex-1"
                value={selectedAccountId ?? undefined}
                onChange={(v) => setSelectedAccountId(v ?? null)}
                options={(accountsQ.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.bankName ? `${a.name} · ${a.bankName}` : a.name,
                }))}
                loading={accountsQ.isLoading}
                popupMatchSelectWidth={false}
              />
              <Flex align="center" gap={8} className="!ms-auto shrink-0">
                <Button
                  type="default"
                  icon={<BulbOutlined />}
                  onClick={toggleTheme}
                  aria-label="تغییر تم"
                />
                <Button
                  type="default"
                  icon={<LogoutOutlined />}
                  onClick={onLogout}
                  loading={loggingOut}
                  aria-label="خروج از حساب"
                />
              </Flex>
            </Flex>
          )}
        </Header>

        <Content
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6",
            isMobileShell && "pb-[5.5rem]"
          )}
        >
          <PageMotion key={pathname}>{children}</PageMotion>
        </Content>

        {isMobileShell ? (
          <BottomNav moreOpen={drawerOpen} onMore={() => setDrawerOpen((open) => !open)} />
        ) : null}
      </Layout>
    </Layout>
  );
}
