"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Button, Typography } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/auth.store";
import { useTourStore } from "@/stores/tour.store";
import { useUiStore } from "@/stores/ui.store";
import { getStepCopy, getTourSteps, type TourStep } from "./tour-steps";
import { cn } from "@/lib/cn";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 8;

function queryTourTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function measureTarget(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: Math.min(window.innerWidth, r.width + PAD * 2),
    height: Math.min(window.innerHeight, r.height + PAD * 2),
  };
}

const SCRIM =
  "pointer-events-none absolute bg-slate-900/35 backdrop-blur-[3px]";

/** Four blurred blue panels around the spotlight hole. */
function TourScrimPanels({ rect }: { rect: Rect }) {
  const right = Math.max(0, window.innerWidth - (rect.left + rect.width));
  const bottom = Math.max(0, window.innerHeight - (rect.top + rect.height));
  return (
    <>
      <div className={SCRIM} style={{ top: 0, left: 0, right: 0, height: rect.top }} />
      <div
        className={SCRIM}
        style={{
          top: rect.top + rect.height,
          left: 0,
          right: 0,
          height: bottom,
        }}
      />
      <div
        className={SCRIM}
        style={{
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
        }}
      />
      <div
        className={SCRIM}
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          width: right,
          height: rect.height,
        }}
      />
    </>
  );
}

type Props = {
  isMobileShell: boolean;
  /** Breakpoint resolved — avoid flashing wrong shell tour */
  shellReady: boolean;
  onRequestMore: (open: boolean) => void;
  onRequestAdd: (open: boolean) => void;
};

export function OnboardingTour({
  isMobileShell,
  shellReady,
  onRequestMore,
  onRequestAdd,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);

  const active = useTourStore((s) => s.active);
  const shell = useTourStore((s) => s.shell);
  const stepIndex = useTourStore((s) => s.stepIndex);
  const sheetRequest = useTourStore((s) => s.sheetRequest);
  const startTour = useTourStore((s) => s.startTour);
  const setStepIndex = useTourStore((s) => s.setStepIndex);
  const setSheetRequest = useTourStore((s) => s.setSheetRequest);
  const completeTour = useTourStore((s) => s.completeTour);
  const skipTour = useTourStore((s) => s.skipTour);
  const isPendingForUser = useTourStore((s) => s.isPendingForUser);
  const hasCompletedForUser = useTourStore((s) => s.hasCompletedForUser);
  const clearPendingForUser = useTourStore((s) => s.clearPendingForUser);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const [mounted, setMounted] = useState(false);
  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(
    null
  );
  const [preparing, setPreparing] = useState(false);

  const steps = useMemo(
    () => (shell ? getTourSteps(shell) : []),
    [shell]
  );
  const step: TourStep | undefined = steps[stepIndex];
  const copy = step ? getStepCopy(step) : null;
  const total = steps.length;
  const isLast = stepIndex >= total - 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-start after register (pending flag) once shell breakpoint is known
  useEffect(() => {
    if (!mounted || !shellReady || !sessionChecked || !user?.id) return;
    if (active) return;
    if (!isPendingForUser(user.id)) return;
    if (hasCompletedForUser(user.id)) {
      clearPendingForUser(user.id);
      return;
    }

    const nextShell = isMobileShell ? "mobile" : "desktop";
    if (!isMobileShell) setSidebarCollapsed(false);
    // Small delay so dashboard paints before the first card
    const t = window.setTimeout(() => {
      startTour(nextShell);
    }, 450);
    return () => window.clearTimeout(t);
  }, [
    mounted,
    shellReady,
    sessionChecked,
    user?.id,
    active,
    isMobileShell,
    isPendingForUser,
    hasCompletedForUser,
    clearPendingForUser,
    startTour,
    setSidebarCollapsed,
  ]);

  // Sync sheet open/close with tour step
  useEffect(() => {
    if (!active) {
      setSheetRequest(null);
      return;
    }
    onRequestMore(sheetRequest === "more");
    onRequestAdd(sheetRequest === "add");
  }, [active, sheetRequest, onRequestMore, onRequestAdd, setSheetRequest]);

  const finish = useCallback(
    (skipped: boolean) => {
      if (!user?.id) {
        useTourStore.getState().stopTour();
        onRequestMore(false);
        onRequestAdd(false);
        return;
      }
      if (skipped) skipTour(user.id);
      else completeTour(user.id);
      onRequestMore(false);
      onRequestAdd(false);
      if (pathname !== "/dashboard") {
        router.replace("/dashboard");
      }
    },
    [
      user?.id,
      skipTour,
      completeTour,
      onRequestMore,
      onRequestAdd,
      pathname,
      router,
    ]
  );

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const prepareAndShow = useCallback(
    async (next: TourStep) => {
      setPreparing(true);
      setSpotlight(null);
      setCardPos(null);

      // Desired sheet state for this step
      setSheetRequest(next.sheet ?? null);
      if (!next.sheet) {
        onRequestMore(false);
        onRequestAdd(false);
      }

      if (next.route && pathnameRef.current !== next.route) {
        router.push(next.route);
        // Wait for route + paint
        await new Promise((r) => setTimeout(r, 280));
      }

      if (next.sheet) {
        await new Promise((r) => setTimeout(r, 360));
      } else {
        await new Promise((r) => setTimeout(r, 40));
      }

      let rect: Rect | null = null;
      if (next.target) {
        // Retry a few times — sheets/menus animate in
        for (let i = 0; i < 8; i++) {
          const el = queryTourTarget(next.target);
          if (el) {
            el.scrollIntoView({ block: "nearest", inline: "nearest" });
            rect = measureTarget(el);
            break;
          }
          await new Promise((r) => setTimeout(r, 80));
        }
      }

      setSpotlight(rect);
      setPreparing(false);

      // Position card — keep clear of the bottom edge (esp. over action sheets)
      const cardW = Math.min(340, window.innerWidth - 32);
      const cardH = 220;
      const topSafe = 20;
      const bottomSafe = Math.max(112, Math.round(window.innerHeight * 0.14));
      const maxTop = window.innerHeight - cardH - bottomSafe;

      if (!rect) {
        setCardPos({
          top: Math.max(topSafe, Math.min(maxTop, (window.innerHeight - cardH) / 2)),
          left: (window.innerWidth - cardW) / 2,
        });
        return;
      }

      // Large targets (Add/More sheets): park the card in the upper band
      if (rect.height > window.innerHeight * 0.38) {
        setCardPos({
          top: Math.round(window.innerHeight * 0.1),
          left: (window.innerWidth - cardW) / 2,
        });
        return;
      }

      const targetMidY = rect.top + rect.height / 2;
      const preferAbove = targetMidY > window.innerHeight * 0.42;
      let top = preferAbove
        ? rect.top - cardH - 14
        : rect.top + rect.height + 14;

      if (top < topSafe) top = rect.top + rect.height + 14;
      if (top > maxTop) top = Math.min(maxTop, Math.max(topSafe, rect.top - cardH - 14));
      top = Math.min(Math.max(topSafe, top), maxTop);

      let left = rect.left + rect.width / 2 - cardW / 2;
      left = Math.min(Math.max(16, left), window.innerWidth - cardW - 16);
      setCardPos({ top, left });
    },
    [router, setSheetRequest, onRequestMore, onRequestAdd]
  );

  useEffect(() => {
    if (!active || !step) return;
    void prepareAndShow(step);
    // Only re-run when the step changes — not on every pathname tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, step?.id]);

  useLayoutEffect(() => {
    if (!active || !step?.target) return;
    const onResize = () => {
      const el = queryTourTarget(step.target!);
      if (!el) return;
      const rect = measureTarget(el);
      setSpotlight(rect);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step]);

  function goNext() {
    if (!step) return;
    if (isLast) {
      finish(false);
      return;
    }
    setStepIndex(stepIndex + 1);
  }

  function goPrev() {
    if (stepIndex <= 0) return;
    setStepIndex(stepIndex - 1);
  }

  if (!mounted || !active || !copy || !step) return null;

  const cardW = Math.min(340, typeof window !== "undefined" ? window.innerWidth - 32 : 340);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tour-root"
        className="fixed inset-0 z-[1200]"
        role="dialog"
        aria-modal="true"
        aria-label="تور آموزشی"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Blue-tinted blur outside the spotlight; keep the target crisp */}
        <div className="absolute inset-0" aria-hidden>
          {spotlight ? (
            <>
              <TourScrimPanels rect={spotlight} />
              <div
                className="pointer-events-none absolute rounded-2xl ring-2 ring-cyan-300/90 transition-[top,left,width,height] duration-200"
                style={{
                  top: spotlight.top,
                  left: spotlight.left,
                  width: spotlight.width,
                  height: spotlight.height,
                  boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.12)",
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[3px]" />
          )}
        </div>

        {/* Block clicks on page except card */}
        <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

        {/*
          Wait for pixel cardPos before mounting the card.
          Using left:50% + translateX(-50%) fought with framer-motion's
          transform (y), so the card briefly sat at the right half then jumped.
        */}
        {cardPos && !preparing ? (
          <motion.div
            key={step.id}
            className={cn(
              "absolute z-10 rounded-2xl",
              "border border-[color-mix(in_srgb,var(--muted)_22%,transparent)]",
              "bg-app-card p-4 shadow-soft"
            )}
            style={{
              top: cardPos.top,
              left: cardPos.left,
              width: cardW,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <Typography.Text type="secondary" className="!text-xs">
                آموزش {stepIndex + 1} از {total}
              </Typography.Text>
              <button
                type="button"
                className="border-0 bg-transparent text-xs text-app-muted cursor-pointer"
                onClick={() => finish(true)}
              >
                رد کردن
              </button>
            </div>
            <Typography.Title level={5} className="!mt-0 !mb-2 !text-base">
              {copy.title}
            </Typography.Title>
            <Typography.Paragraph className="!mb-4 !text-sm !text-app-muted !leading-relaxed">
              {copy.body}
            </Typography.Paragraph>
            <div className="flex items-center justify-between gap-2">
              <Button disabled={stepIndex === 0} onClick={goPrev}>
                قبلی
              </Button>
              <Button type="primary" onClick={goNext}>
                {isLast ? "پایان" : "بعدی"}
              </Button>
            </div>
          </motion.div>
        ) : null}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
