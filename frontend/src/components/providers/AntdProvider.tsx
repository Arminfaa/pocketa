"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import faIR from "antd/locale/fa_IR";
import JalaliProvider from "antd-jalali-v5";
import { useThemeStore } from "@/stores/theme.store";

const brand = {
  colorPrimary: "#2563eb",
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
            colorBgContainer: isDark ? "#111827" : "#ffffff",
            colorBgLayout: isDark ? "#0b1220" : "#eef5ff",
            colorText: isDark ? "#e5e7eb" : "#0f172a",
            colorTextSecondary: isDark ? "#93a4b8" : "#64748b",
            colorBorder: isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(37, 99, 235, 0.1)",
          },
          components: {
            Layout: {
              siderBg: isDark ? "#111827" : "#ffffff",
              headerBg: isDark ? "#111827" : "rgba(255,255,255,0.92)",
              bodyBg: "transparent",
            },
            Menu: {
              itemBorderRadius: 14,
              itemBg: "transparent",
              subMenuItemBg: "transparent",
              darkItemBg: "transparent",
              darkSubMenuItemBg: "transparent",
              itemSelectedBg: isDark ? "rgba(59,130,246,0.18)" : "rgba(37,99,235,0.1)",
              itemSelectedColor: isDark ? "#60a5fa" : "#2563eb",
            },
            Drawer: {
              colorBgElevated: isDark ? "#111827" : "#ffffff",
            },
            Card: {
              borderRadiusLG: 24,
            },
            Button: {
              controlHeight: 42,
              borderRadius: 14,
            },
            Input: {
              controlHeight: 42,
              borderRadius: 14,
            },
            Select: {
              controlHeight: 42,
              borderRadius: 14,
            },
            DatePicker: {
              controlHeight: 42,
              borderRadius: 14,
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
