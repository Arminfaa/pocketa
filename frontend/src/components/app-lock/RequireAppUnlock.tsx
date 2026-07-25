"use client";

import { useEffect, type ReactNode } from "react";
import { AppLockOverlay } from "@/components/app-lock/AppLockOverlay";
import { useAppLockStore } from "@/stores/app-lock.store";

/**
 * Hydrates device app-lock, locks on cold start / after grace when returning
 * from background, and renders a full-screen unlock overlay.
 */
export function RequireAppUnlock({ children }: { children: ReactNode }) {
  const hydrated = useAppLockStore((s) => s.hydrated);
  const enabled = useAppLockStore((s) => s.enabled);
  const locked = useAppLockStore((s) => s.locked);
  const hydrate = useAppLockStore((s) => s.hydrate);
  const markHidden = useAppLockStore((s) => s.markHidden);
  const evaluateVisibility = useAppLockStore((s) => s.evaluateVisibility);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (!hydrated || !enabled) return;

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        markHidden();
      } else {
        evaluateVisibility();
      }
    }

    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) evaluateVisibility();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [hydrated, enabled, markHidden, evaluateVisibility]);

  const showLock = !hydrated || (enabled && locked);

  return (
    <>
      {children}
      <AppLockOverlay open={showLock} />
    </>
  );
}
