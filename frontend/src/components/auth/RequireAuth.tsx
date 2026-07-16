"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    async function run() {
      if (!hydrated) return;
      if (!accessToken) {
        router.replace("/login");
        return;
      }
      if (user) return;
      try {
        const res = await api.get("/api/auth/me");
        setUser(res.data?.data?.user ?? null);
      } catch {
        useAuthStore.getState().logout();
        router.replace("/login");
      }
    }
    void run();
  }, [accessToken, hydrated, router, setUser, user]);

  if (!hydrated || (accessToken && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted)]">در حال آماده‌سازی...</div>
      </div>
    );
  }

  return <>{children}</>;
}

