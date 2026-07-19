"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "antd";
import { BulbOutlined, LogoutOutlined } from "@ant-design/icons";
import {
  motion,
  useAnimationControls,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { MORE_NAV_ITEMS, matchNavHref } from "./nav-items";
import { cn } from "@/lib/cn";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
};

const DISMISS_DISTANCE = 88;
const DISMISS_VELOCITY = 720;

const SPRING = { type: "spring" as const, stiffness: 440, damping: 40, mass: 0.8 };
const EASE_OUT = { type: "tween" as const, duration: 0.3, ease: [0.32, 0.72, 0, 1] as const };

export function MoreActionSheet({
  open,
  onClose,
  mode,
  onToggleTheme,
  onLogout,
  loggingOut,
}: Props) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [interactive, setInteractive] = useState(true);

  const sheetControls = useAnimationControls();
  const closingRef = useRef(false);
  const openRef = useRef(open);
  const y = useMotionValue(0);
  const maskOpacity = useTransform(y, [0, 420], [1, 0]);

  openRef.current = open;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Parent opened → mount + spring in
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
  }, [present, open, sheetControls]);

  // Parent closed while sheet still mounted → ease out
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

  function requestClose() {
    if (closingRef.current) return;
    onClose();
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const shouldClose =
      info.offset.y >= DISMISS_DISTANCE || info.velocity.y >= DISMISS_VELOCITY;

    if (!shouldClose) {
      void sheetControls.start({ y: 0, transition: SPRING });
      return;
    }

    if (closingRef.current) return;
    closingRef.current = true;
    setInteractive(false);
    // Keep downward momentum from the drag position — never snap to 0 first
    void sheetControls.start({ y: "100%", transition: EASE_OUT }).then(() => {
      setPresent(false);
      y.set(0);
      closingRef.current = false;
      onClose();
    });
  }

  if (!mounted || !present) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100]" role="presentation">
      <motion.button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 border-0 cursor-default bg-slate-900/45 dark:bg-black/65 backdrop-blur-[4px]"
        style={{ opacity: maskOpacity }}
        onClick={requestClose}
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="بیشتر"
        className={cn(
          "absolute inset-x-0 bottom-0 max-h-[min(78dvh,640px)]",
          "rounded-t-[1.75rem] bg-app-card",
          "shadow-[0_-12px_40px_rgba(15,23,42,0.16)]",
          "will-change-transform"
        )}
        data-tour="more-sheet"
        data-body-scroll-lock={present ? "1" : undefined}
        style={{
          y,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        initial={false}
        animate={sheetControls}
        drag={interactive ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.03, bottom: 0.58 }}
        dragMomentum={false}
        onDragEnd={onDragEnd}
      >
        <div className="px-4 pb-4 pt-1">
          <div className="select-none -mx-4 px-4 pt-2 pb-1 touch-none">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--muted)_28%,transparent)]" />
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-app-fg">بیشتر</div>
                <div className="text-xs text-app-muted">میانبر بخش‌ها و تنظیمات</div>
              </div>
              <Button
                type="text"
                onClick={requestClose}
                onPointerDown={(e) => e.stopPropagation()}
                className="!rounded-xl !text-app-muted"
              >
                بستن
              </Button>
            </div>
          </div>

          <div
            className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {MORE_NAV_ITEMS.map((item) => {
              const active = matchNavHref(pathname, item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={requestClose}
                  data-tour={`nav-${item.key}-more`}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors",
                    active
                      ? "bg-brand-500/12 text-brand-600 dark:text-brand-300"
                      : "bg-[color-mix(in_srgb,var(--muted)_7%,transparent)] text-app-fg hover:bg-brand-500/8"
                  )}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="text-[11px] font-medium leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div
            className="mt-4 grid grid-cols-2 gap-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              block
              size="large"
              icon={<BulbOutlined />}
              onClick={onToggleTheme}
              className="!h-12"
            >
              {mode === "dark" ? "حالت روشن" : "حالت تاریک"}
            </Button>
            <Button
              block
              size="large"
              danger
              icon={<LogoutOutlined />}
              onClick={onLogout}
              loading={loggingOut}
              className="!h-12"
            >
              خروج
            </Button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
