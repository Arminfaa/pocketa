"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { BootSpinner } from "@/components/ui/boot-spinner";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionChecked = useAuthStore((s) => s.setSessionChecked);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    async function run() {
      if (!hydrated || sessionChecked) return;

      try {
        // 401 → axios interceptor refreshes via httpOnly cookie, then retries.
        const res = await api.get("/api/auth/me");
        const nextUser = res.data?.data?.user ?? null;
        setUser(nextUser);
        setSessionChecked(true);
        if (!nextUser) router.replace("/login");
      } catch {
        useAuthStore.getState().logout();
        router.replace("/login");
      }
    }
    void run();
  }, [hydrated, router, sessionChecked, setSessionChecked, setUser]);

  useEffect(() => {
    if (hydrated && sessionChecked && !user) {
      router.replace("/login");
    }
  }, [hydrated, sessionChecked, user, router]);

  // Optimistic: cached user → render app shell immediately while /me revalidates
  if (user && !sessionChecked) {
    return <>{children}</>;
  }

  // Auth boot: spinner first; page content uses its own skeleton after this.
  if (!hydrated || !sessionChecked || !user) {
    return <BootSpinner />;
  }

  return <>{children}</>;
}
