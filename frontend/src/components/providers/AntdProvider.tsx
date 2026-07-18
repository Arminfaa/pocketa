"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import faIR from "antd/locale/fa_IR";
import JalaliProvider from "antd-jalali-v5";
import { useThemeStore } from "@/stores/theme.store";

const brand = {
  colorPrimary: "#06b6d4",
  borderRadius: 16,
  fontFamily: "var(--font-vazir), Tahoma, Arial, sans-serif",
};

export function AntdProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === "dark";

  return (
    <AntdRegistry>
      <ConfigProvider
        direction="rtl"
        locale={faIR}
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            ...brand,
            colorBgContainer: isDark ? "#0f1a2e" : "#ffffff",
            colorBgLayout: isDark ? "#0b1220" : "#f8fafc",
            colorText: isDark ? "#e5e7eb" : "#0f172a",
            colorTextSecondary: isDark ? "#93a4b8" : "#475569",
            colorBorder: "transparent",
            colorBorderSecondary: "transparent",
          },
          components: {
            Layout: {
              siderBg: isDark ? "#0f1a2e" : "rgba(255,255,255,0.9)",
              headerBg: "transparent",
              bodyBg: "transparent",
            },
            Menu: {
              itemBorderRadius: 14,
              itemBg: "transparent",
              subMenuItemBg: "transparent",
              darkItemBg: "transparent",
              darkSubMenuItemBg: "transparent",
              itemSelectedBg: isDark ? "rgba(34,211,238,0.14)" : "rgba(6,182,212,0.12)",
              itemSelectedColor: isDark ? "#22d3ee" : "#0891b2",
            },
            Drawer: {
              colorBgElevated: isDark ? "#0f1a2e" : "#ffffff",
            },
            Card: {
              borderRadiusLG: 24,
              colorBorderSecondary: "transparent",
            },
            Button: {
              controlHeight: 42,
              borderRadius: 16,
            },
            Input: {
              controlHeight: 42,
              borderRadius: 16,
            },
            Select: {
              controlHeight: 42,
              borderRadius: 16,
            },
            DatePicker: {
              controlHeight: 42,
              borderRadius: 16,
            },
            Segmented: {
              borderRadius: 16,
              borderRadiusSM: 12,
              itemSelectedBg: isDark ? "#0f1a2e" : "#ffffff",
            },
            Tag: {
              borderRadiusSM: 8,
            },
            Modal: {
              borderRadiusLG: 24,
            },
          },
        }}
      >
        <JalaliProvider />
        <App message={{ maxCount: 3 }} notification={{ placement: "topLeft" }}>
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
