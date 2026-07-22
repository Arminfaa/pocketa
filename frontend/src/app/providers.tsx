"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ThemeInitializer } from "@/components/theme/ThemeInitializer";
import { AntdProvider } from "@/components/providers/AntdProvider";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { OfflineSyncProvider } from "@/features/offline/OfflineSyncProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            /** Prefer cache on navigation; mutations still invalidate explicitly */
            staleTime: 60_000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <PwaRegister />
      <AntdProvider>
        <OfflineSyncProvider>{children}</OfflineSyncProvider>
      </AntdProvider>
    </QueryClientProvider>
  );
}
