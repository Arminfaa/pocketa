"use client";

import { PropsWithChildren, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Drawer, Flex, Grid, Layout, Select, theme } from "antd";
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
  const isMobile = !screens.md;

  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleCollapse = useUiStore((s) => s.toggleSidebarCollapsed);
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);
  const setSelectedAccountId = useAccountFilterStore((s) => s.setSelectedAccountId);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { token } = theme.useToken();

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
  });

  return (
    <Layout className="min-h-screen !bg-transparent overflow-x-hidden">
      {!isMobile ? (
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          width={256}
          collapsedWidth={72}
          className="!sticky !top-0 !h-screen overflow-auto border-l"
          style={{ borderColor: token.colorBorder, background: token.colorBgContainer }}
        >
          <Sidebar />
        </Sider>
      ) : null}

      <Drawer
        placement="right"
        open={isMobile && mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
        title="منو"
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Layout className="!bg-transparent min-w-0 max-w-full">
        <Header
          className="!sticky !top-0 !z-10 !px-2 sm:!px-4 !h-auto !min-h-16 !leading-none border-b !py-2"
          style={{
            background: token.colorBgContainer,
            borderColor: token.colorBorder,
            lineHeight: "normal",
          }}
        >
          <Flex align="center" gap={8} wrap="wrap" className="w-full">
            {isMobile ? (
              <Button
                type="default"
                icon={<MenuOutlined />}
                onClick={() => setMobileOpen(true)}
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
              className="flex-1 min-w-0"
              style={{ minWidth: isMobile ? 0 : 160, maxWidth: isMobile ? "100%" : 240 }}
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

        <Content className="p-3 sm:p-4 md:p-6 min-w-0 overflow-x-hidden">
          <PageMotion key={pathname}>{children}</PageMotion>
        </Content>
      </Layout>
    </Layout>
  );
}
