"use client";

import { PropsWithChildren, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Drawer, Flex, Grid, Layout, Select } from "antd";
import { cn } from "@/lib/cn";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import { Sidebar } from "./Sidebar";
import { useUiStore } from "@/stores/ui.store";
import { useThemeStore } from "@/stores/theme.store";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { fetchAccounts } from "@/services/accounts";
import { PageMotion } from "@/components/ui/page-motion";
import { usePathname } from "next/navigation";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export default function AppLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const screens = useBreakpoint();
  /** Below Ant Design `lg` (~992px): menu button + Drawer only */
  const isDrawerNav = !screens.lg;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountFilterStore((s) => s.setSelectedAccountId);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  useEffect(() => {
    if (!isDrawerNav) setDrawerOpen(false);
  }, [isDrawerNav]);

  return (
    <Layout className="h-dvh max-h-dvh !bg-transparent overflow-hidden">
      {!isDrawerNav ? (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={256}
          collapsedWidth={72}
          className="!h-dvh !max-h-dvh shrink-0 overflow-hidden border-l border-app-border bg-app-card"
        >
          <Sidebar />
        </Sider>
      ) : null}

      <Drawer
        placement="right"
        open={isDrawerNav && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={280}
        classNames={{ body: "!p-0", header: "border-b border-app-border" }}
        title={
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Pocketa"
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="font-semibold text-app-fg truncate">Pocketa</span>
          </div>
        }
        destroyOnClose
      >
        <Sidebar forceExpanded hideBrand onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <Layout className="!bg-transparent min-w-0 max-w-full flex-1 h-dvh max-h-dvh overflow-hidden flex flex-col">
        <Header className="shrink-0 !px-2 sm:!px-4 !h-auto !min-h-16 !leading-normal border-b border-app-border bg-app-card !py-2 z-20">
          <Flex align="center" gap={8} wrap="wrap" className="w-full">
            {isDrawerNav ? (
              <Button
                type="default"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
                aria-label="منو"
              />
            ) : (
              <Button
                type="default"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapse}
                aria-label="جمع کردن سایدبار"
              />
            )}

            <Select
              allowClear
              placeholder="همه حساب‌ها"
              className={cn(
                "flex-1 min-w-0",
                isDrawerNav ? "max-w-full" : "min-w-40 max-w-60"
              )}
              value={selectedAccountId ?? undefined}
              onChange={(v) => setSelectedAccountId(v ?? null)}
              options={(accountsQ.data ?? []).map((a) => ({
                value: a.id,
                label: a.bankName ? `${a.name} · ${a.bankName}` : a.name,
              }))}
              loading={accountsQ.isLoading}
              popupMatchSelectWidth={false}
            />

            <Button
              type="default"
              icon={<BulbOutlined />}
              onClick={toggleTheme}
              aria-label="تغییر تم"
              title={mode === "dark" ? "حالت روشن" : "حالت تاریک"}
              className="!ms-auto"
            />
          </Flex>
        </Header>

        <Content className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 overscroll-contain">
          <PageMotion key={pathname}>{children}</PageMotion>
        </Content>
      </Layout>
    </Layout>
  );
}
