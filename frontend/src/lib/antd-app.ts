"use client";

import { App } from "antd";

/** Ant Design toast helpers — use inside client components under AntdProvider. */
export function useAppMessage() {
  return App.useApp();
}
