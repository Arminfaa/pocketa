"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "antd";
import { PlusOutlined, RightOutlined } from "@ant-design/icons";
import {
  motion,
  useAnimationControls,
  useDragControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ADD_SHORTCUT_ITEMS } from "./nav-items";
import { cn } from "@/lib/cn";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 720;

const SPRING = { type: "spring" as const, stiffness: 440, damping: 40, mass: 0.8 };
const EASE_OUT = { type: "tween" as const, duration: 0.3, ease: [0.32, 0.72, 0, 1] as const };

const PRIMARY_KEY = "add-transaction";

const GROUPS: Array<{ title: string; keys: string[] }> = [
  { title: "جابه‌جایی پول", keys: ["add-transfer", "add-import"] },
  { title: "برنامه‌ریزی", keys: ["add-investment", "add-goal", "add-recurring"] },
  { title: "ساختار حساب", keys: ["add-account", "add-category", "add-budget"] },
];

type BodyGesture = {
  pointerId: number | null;
  startY: number;
  lastY: number;
  lastT: number;
  mode: "undecided" | "scroll" | "sheet";
  velocityY: number;
};

export function AddActionSheet({ open, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [interactive, setInteractive] = useState(true);

  const sheetControls = useAnimationControls();
  const dragControls = useDragControls();
  const closingRef = useRef(false);
  const openRef = useRef(open);
  const scrollRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const maskOpacity = useTransform(y, [0, 420], [1, 0]);

  const bodyGestureRef = useRef<BodyGesture>({
    pointerId: null,
    startY: 0,
    lastY: 0,
    lastT: 0,
    mode: "undecided",
    velocityY: 0,
  });

  openRef.current = open;

  const primary = ADD_SHORTCUT_ITEMS.find((item) => item.key === PRIMARY_KEY);
  const byKey = new Map(ADD_SHORTCUT_ITEMS.map((item) => [item.key, item]));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    setInteractive(true);
    y.set(typeof window !== "undefined" ? window.innerHeight : 800);
    setPresent(true);
  }, [open, y]);

  useEffect(() => {
    if (!present || !open || closingRef.current) return;
    void sheetControls.start({ y: 0, transition: SPRING });
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
  }, [present, open, sheetControls]);

  useEffect(() => {
    if (open || !present || closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);
    void sheetControls.start({ y: "100%", transition: EASE_OUT }).then(() => {
      if (openRef.current) {
        closingRef.current = false;
        return;
      }
      setPresent(false);
      y.set(0);
      closingRef.current = false;
    });
  }, [open, present, sheetControls, y]);

  useBodyScrollLock(present);

  // Block native scroll while the sheet-dismiss pull is active.
  useEffect(() => {
    if (!present) return;
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (bodyGestureRef.current.mode === "sheet") {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", onTouchMove);
  }, [present]);

  function requestClose() {
    if (closingRef.current) return;
    onClose();
  }

  function finishDismiss() {
    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);
    void sheetControls.start({ y: "100%", transition: EASE_OUT }).then(() => {
      setPresent(false);
      y.set(0);
      closingRef.current = false;
      onClose();
    });
  }

  function snapSheetOpen() {
    void sheetControls.start({ y: 0, transition: SPRING });
  }

  function onHeaderDragEnd(_: unknown, info: PanInfo) {
    const shouldClose =
      info.offset.y >= DISMISS_DISTANCE || info.velocity.y >= DISMISS_VELOCITY;
    if (!shouldClose) {
      snapSheetOpen();
      return;
    }
    finishDismiss();
  }

  function isScrollAtTop() {
    return (scrollRef.current?.scrollTop ?? 0) <= 0;
  }

  function onHeaderPointerDown(e: React.PointerEvent) {
    if (!interactive || closingRef.current) return;
    // Don't start drag from the close button
    if ((e.target as HTMLElement).closest("button")) return;
    dragControls.start(e);
  }

  function resetBodyGesture() {
    bodyGestureRef.current = {
      pointerId: null,
      startY: 0,
      lastY: 0,
      lastT: 0,
      mode: "undecided",
      velocityY: 0,
    };
  }

  function onBodyPointerDown(e: React.PointerEvent) {
    if (!interactive || closingRef.current) return;
    // Links/buttons handle their own clicks; still track for gesture lock
    bodyGestureRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      mode: isScrollAtTop() ? "undecided" : "scroll",
      velocityY: 0,
    };
  }

  function onBodyPointerMove(e: React.PointerEvent) {
    const g = bodyGestureRef.current;
    if (g.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dyTotal = e.clientY - g.startY;
    const dt = Math.max(1, now - g.lastT);
    g.velocityY = ((e.clientY - g.lastY) / dt) * 1000;
    g.lastY = e.clientY;
    g.lastT = now;

    if (g.mode === "undecided") {
      if (Math.abs(dyTotal) < 10) return;
      if (dyTotal > 0 && isScrollAtTop()) {
        g.mode = "sheet";
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      } else {
        g.mode = "scroll";
        return;
      }
    }

    if (g.mode !== "sheet") return;

    // Pulling down at top moves the sheet; don't scroll the body
    e.preventDefault();
    y.set(Math.max(0, dyTotal));
  }

  function onBodyPointerUp(e: React.PointerEvent) {
    const g = bodyGestureRef.current;
    if (g.pointerId !== e.pointerId) return;

    if (g.mode === "sheet") {
      const offsetY = Math.max(0, y.get());
      const shouldClose =
        offsetY >= DISMISS_DISTANCE || g.velocityY >= DISMISS_VELOCITY;
      if (shouldClose) finishDismiss();
      else snapSheetOpen();
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    resetBodyGesture();
  }

  if (!mounted || !present) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100]" role="presentation">
      <motion.button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 border-0 cursor-default bg-slate-900/50 dark:bg-black/70 backdrop-blur-[6px]"
        style={{ opacity: maskOpacity }}
        onClick={requestClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="افزودن"
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[min(82dvh,680px)] flex-col",
          "rounded-t-[1.85rem]",
          "bg-gradient-to-b from-cyan-500/[0.12] via-[var(--card)] to-[var(--card)]",
          "dark:from-brand-500/[0.16] dark:via-[var(--card)] dark:to-[var(--card)]",
          // Light: navbar-matching hairline, no shadow. Dark: keep ring + lift shadow.
          "border border-b-0 border-[color-mix(in_srgb,var(--muted)_22%,transparent)] shadow-none",
          "dark:border-transparent dark:ring-1 dark:ring-inset dark:ring-brand-400/15",
          "dark:shadow-[0_-16px_48px_rgba(0,0,0,0.45)]",
          "will-change-transform"
        )}
        data-tour="add-sheet"
        data-body-scroll-lock={present ? "1" : undefined}
        style={{
          y,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        initial={false}
        animate={sheetControls}
        drag={interactive ? "y" : false}
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.03, bottom: 0.58 }}
        dragMomentum={false}
        onDragEnd={onHeaderDragEnd}
      >
        <div
          className="shrink-0 select-none px-4 pt-2 pb-1 touch-none"
          onPointerDown={onHeaderPointerDown}
        >
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-slate-400/70 dark:bg-brand-300/35" />
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-[0_8px_18px_rgba(8,145,178,0.35)] dark:from-brand-400 dark:to-teal-400">
                <PlusOutlined className="text-base" />
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 dark:text-app-fg">
                  ثبت سریع
                </div>
                <div className="text-xs text-slate-600 dark:text-app-muted">
                  یک مورد جدید بسازید
                </div>
              </div>
            </div>
            <Button
              type="text"
              onClick={requestClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="!rounded-xl !font-semibold !text-brand-600 dark:!font-normal dark:!text-app-muted"
            >
              بستن
            </Button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-5 pt-2 [-webkit-overflow-scrolling:touch]"
          onPointerDown={onBodyPointerDown}
          onPointerMove={onBodyPointerMove}
          onPointerUp={onBodyPointerUp}
          onPointerCancel={onBodyPointerUp}
        >
          <div className="space-y-4">
            {primary ? (
              <Link
                href={primary.href}
                onClick={requestClose}
                className={cn(
                  "flex items-center gap-3 rounded-[1.35rem] px-4 py-3.5 no-underline transition-transform active:scale-[0.99]",
                  "bg-gradient-to-l from-cyan-600 to-teal-500 text-white",
                  "shadow-[0_12px_28px_rgba(8,145,178,0.32)]",
                  "dark:from-brand-500 dark:to-teal-500 dark:shadow-[0_12px_28px_rgba(34,211,238,0.18)]"
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/18 text-xl">
                  {primary.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">
                    تراکنش جدید
                  </span>
                  <span className="mt-0.5 block text-[11px] text-white/80">
                    درآمد یا هزینه را همین حالا ثبت کنید
                  </span>
                </span>
                <RightOutlined className="rotate-180 text-sm text-white/75" />
              </Link>
            ) : null}

            {GROUPS.map((group) => {
              const items = group.keys
                .map((key) => byKey.get(key))
                .filter((item): item is NonNullable<typeof item> => Boolean(item));
              if (!items.length) return null;

              return (
                <div key={group.title} className="space-y-2">
                  <div className="px-1 text-[11px] font-medium text-slate-500 dark:text-app-muted">
                    {group.title}
                  </div>
                  <div className="overflow-hidden rounded-[1.25rem] bg-white/80 ring-1 ring-slate-900/5 dark:bg-[color-mix(in_srgb,var(--card)_88%,#000)] dark:ring-white/8">
                    {items.map((item, index) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={requestClose}
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-3 no-underline transition-colors",
                          "text-slate-900 hover:bg-cyan-500/8 dark:text-app-fg dark:hover:bg-brand-500/10",
                          index > 0 &&
                            "border-t border-slate-900/6 dark:border-white/8"
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/12 text-base text-cyan-700 dark:bg-brand-500/18 dark:text-brand-200">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium leading-tight">
                          {item.label}
                        </span>
                        <RightOutlined className="rotate-180 text-[11px] text-slate-400 dark:text-app-muted" />
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
