"use client";

import { DisconnectOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { cn } from "@/lib/cn";

const { Text } = Typography;

export const OFFLINE_BANNER_TEXT =
  "حالت آفلاین - ثبت تراکنش ها محلی ذخیره می‌شوند";

type Props = {
  className?: string;
  /** Compact chip for header */
  compact?: boolean;
};

export function OfflineBannerContent({ className, compact = false }: Props) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full",
          "bg-slate-500/15 text-slate-600 dark:bg-white/10 dark:text-slate-300",
          className
        )}
        title={OFFLINE_BANNER_TEXT}
        aria-label={OFFLINE_BANNER_TEXT}
      >
        <DisconnectOutlined />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5",
        "bg-slate-900/90 text-white ring-1 ring-white/10",
        "dark:bg-slate-950/95 dark:ring-white/10",
        className
      )}
      role="status"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
        <DisconnectOutlined />
      </span>
      <Text className="!m-0 min-w-0 flex-1 !text-sm !font-semibold !text-inherit">
        {OFFLINE_BANNER_TEXT}
      </Text>
    </div>
  );
}
