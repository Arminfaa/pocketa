"use client";

import { Button, Flex, Grid, Typography } from "antd";
import { CloudSyncOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useOfflineOutbox } from "@/hooks/use-offline-outbox";
import { syncOutbox } from "@/lib/offline/sync";
import { toPersianDigits } from "@/lib/format";
import { useAppMessage } from "@/lib/antd-app";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  OfflineBannerContent,
} from "@/features/offline/OfflineBannerContent";

const { Text } = Typography;
const { useBreakpoint } = Grid;

/** Pages that render MarketPriceTicker — offline strip lives there on mobile. */
function pageHasPriceTicker(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/investments");
}

export function OfflineStatusBanner() {
  const online = useOnlineStatus();
  const { count, userId, items } = useOfflineOutbox();
  const queryClient = useQueryClient();
  const { message } = useAppMessage();
  const [syncing, setSyncing] = useState(false);
  const pathname = usePathname();
  const screens = useBreakpoint();
  const isMobile = !screens.lg;

  const failed = items.filter((i) => i.status === "failed").length;

  async function handleSync() {
    if (!userId || !online) return;
    setSyncing(true);
    try {
      const result = await syncOutbox(userId);
      if (result.synced > 0) {
        message.success(
          `${toPersianDigits(String(result.synced))} تراکنش همگام‌سازی شد`
        );
        void queryClient.invalidateQueries({ queryKey: ["transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } else if (result.failed > 0) {
        message.error("برخی تراکنش‌ها همگام‌سازی نشدند");
      } else {
        message.info("موردی برای ارسال نبود");
      }
    } finally {
      setSyncing(false);
    }
  }

  // Offline on pages with MarketPriceTicker → strip lives inside the ticker
  if (!online && pageHasPriceTicker(pathname)) {
    return null;
  }

  if (online && count === 0) return null;

  // Offline on pages without ticker
  if (!online) {
    return (
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[900] flex justify-center px-3",
          isMobile
            ? "top-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))]"
            : "bottom-4"
        )}
      >
        <div
          className={cn(
            "pointer-events-auto w-full",
            isMobile ? "max-w-none" : "max-w-lg lg:max-w-xl"
          )}
        >
          <OfflineBannerContent />
        </div>
      </div>
    );
  }

  // Online with pending outbox
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[900] flex justify-center px-3",
        "bottom-[calc(var(--bottom-nav-height,5.5rem)+0.75rem)] lg:bottom-4"
      )}
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl px-3.5 py-2.5 shadow-soft",
          "ring-1 backdrop-blur-xl",
          "bg-amber-500/15 text-amber-950 ring-amber-500/25 dark:bg-amber-400/15 dark:text-amber-50 dark:ring-amber-300/25"
        )}
        role="status"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/10 dark:bg-white/10">
          <CloudSyncOutlined />
        </span>
        <div className="min-w-0 flex-1">
          <Text className="!m-0 block !text-sm !font-semibold !text-inherit">
            {`${toPersianDigits(String(count))} تراکنش در صف ارسال`}
          </Text>
          {failed > 0 ? (
            <Text className="!m-0 block !text-xs !text-inherit opacity-80">
              {toPersianDigits(String(failed))} مورد با خطا — دوباره تلاش کنید
            </Text>
          ) : null}
        </div>
        <Flex>
          <Button
            size="small"
            type="primary"
            loading={syncing}
            onClick={() => void handleSync()}
            className="!rounded-xl"
          >
            ارسال
          </Button>
        </Flex>
      </div>
    </div>
  );
}
