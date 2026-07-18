"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { AppShellSkeleton } from "@/components/skeletons";

function loginUrlWithNext(pathname: string, search: string): string {
  const next = `${pathname}${search}`;
  if (!next || next === "/" || next.startsWith("/login")) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useAuthStore((s) => s.hydrated);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionChecked = useAuthStore((s) => s.setSessionChecked);

  const search = searchParams?.toString() ? `?${searchParams.toString()}` : "";

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
        if (!nextUser) router.replace(loginUrlWithNext(pathname, search));
      } catch {
        useAuthStore.getState().logout();
        router.replace(loginUrlWithNext(pathname, search));
      }
    }
    void run();
  }, [hydrated, pathname, router, search, sessionChecked, setSessionChecked, setUser]);

  useEffect(() => {
    if (hydrated && sessionChecked && !user) {
      router.replace(loginUrlWithNext(pathname, search));
    }
  }, [hydrated, pathname, search, sessionChecked, user, router]);

  // Optimistic: cached user → render app shell immediately while /me revalidates
  if (user && !sessionChecked) {
    return <>{children}</>;
  }

  if (!hydrated || !sessionChecked || !user) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}
