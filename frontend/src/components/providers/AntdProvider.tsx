"use client";

import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider, theme as antdTheme } from "antd";
import faIR from "antd/locale/fa_IR";
import { useThemeStore } from "@/stores/theme.store";

const brand = {
  colorPrimary: "#06b6d4",
  borderRadius: 12,
  fontFamily: "var(--font-vazir), Vazirmatn, Tahoma, sans-serif",
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
            colorBorder: isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(15, 23, 42, 0.12)",
          },
          components: {
            Layout: {
              siderBg: isDark ? "#0f1a2e" : "#ffffff",
              headerBg: isDark ? "#0f1a2e" : "#ffffff",
              bodyBg: "transparent",
            },
            Menu: {
              itemBorderRadius: 12,
            },
            Card: {
              borderRadiusLG: 16,
            },
            Button: {
              controlHeight: 40,
            },
            Input: {
              controlHeight: 40,
              borderRadius: 12,
            },
            Select: {
              controlHeight: 40,
              borderRadius: 12,
            },
          },
        }}
      >
        <App message={{ maxCount: 3 }} notification={{ placement: "topLeft" }}>
          {children}
        </App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
