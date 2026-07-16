"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";

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

  // Avoid infinite "preparing" when session was marked checked but user cleared (e.g. 401 logout).
  useEffect(() => {
    if (hydrated && sessionChecked && !user) {
      router.replace("/login");
    }
  }, [hydrated, sessionChecked, user, router]);

  if (!hydrated || !sessionChecked || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-app-muted">در حال آماده‌سازی...</div>
      </div>
    );
  }

  return <>{children}</>;
}
