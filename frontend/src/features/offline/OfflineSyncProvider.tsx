"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { fetchAccounts } from "@/services/accounts";
import { fetchCategories } from "@/services/transactions";
import { saveAccountsSnapshot, saveCategoriesSnapshot } from "@/lib/offline/snapshots";
import { syncOutbox } from "@/lib/offline/sync";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { QuickCaptureModalHost } from "@/features/offline/QuickCaptureModalHost";
import { OfflineStatusBanner } from "@/features/offline/OfflineStatusBanner";

/**
 * Keeps accounts/categories snapshots fresh, runs outbox sync when back online,
 * and mounts global quick-capture + status banner.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const wasOnline = useRef(online);

  const accountsQ = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts,
    staleTime: 5 * 60_000,
    enabled: Boolean(userId),
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId || !accountsQ.data) return;
    void saveAccountsSnapshot(userId, accountsQ.data);
  }, [userId, accountsQ.data]);

  useEffect(() => {
    if (!userId || !categoriesQ.data) return;
    void saveCategoriesSnapshot(userId, categoriesQ.data);
  }, [userId, categoriesQ.data]);

  useEffect(() => {
    if (!userId || !online) {
      wasOnline.current = online;
      return;
    }

    const cameOnline = !wasOnline.current && online;
    wasOnline.current = online;

    let cancelled = false;
    async function run() {
      const result = await syncOutbox(userId);
      if (cancelled) return;
      if (result.synced > 0) {
        void queryClient.invalidateQueries({ queryKey: ["transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }
    }

    void run();

    if (cameOnline) {
      // also retry shortly after reconnect (cookies/network settle)
      const t = window.setTimeout(() => void run(), 1500);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [userId, online, queryClient]);

  useEffect(() => {
    if (!userId) return;
    function onVisible() {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void syncOutbox(userId).then((result) => {
          if (result.synced > 0) {
            void queryClient.invalidateQueries({ queryKey: ["transactions"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            void queryClient.invalidateQueries({ queryKey: ["accounts"] });
          }
        });
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, queryClient]);

  return (
    <>
      {children}
      {userId ? (
        <>
          <OfflineStatusBanner />
          <QuickCaptureModalHost />
        </>
      ) : null}
    </>
  );
}
