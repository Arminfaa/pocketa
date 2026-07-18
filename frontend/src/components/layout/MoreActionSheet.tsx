"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer } from "antd";
import { BulbOutlined, LogoutOutlined } from "@ant-design/icons";
import { MORE_NAV_ITEMS, matchNavHref } from "./nav-items";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
};

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.55;

export function MoreActionSheet({
  open,
  onClose,
  mode,
  onToggleTheme,
  onLogout,
  loggingOut,
}: Props) {
  const pathname = usePathname();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTsRef = useRef(0);
  const velocityRef = useRef(0);
  const dragYRef = useRef(0);

  useEffect(() => {
    if (!open) {
      draggingRef.current = false;
      setDragging(false);
      setDragY(0);
      dragYRef.current = 0;
      velocityRef.current = 0;
    }
  }, [open]);

  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    draggingRef.current = true;
    startYRef.current = e.clientY;
    lastYRef.current = e.clientY;
    lastTsRef.current = e.timeStamp;
    velocityRef.current = 0;
    dragYRef.current = 0;
    setDragging(true);
    setDragY(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const next = Math.max(0, e.clientY - startYRef.current);
    const dt = Math.max(1, e.timeStamp - lastTsRef.current);
    velocityRef.current = (e.clientY - lastYRef.current) / dt;
    lastYRef.current = e.clientY;
    lastTsRef.current = e.timeStamp;
    dragYRef.current = next;
    setDragY(next);
  }

  function endDrag() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    const shouldClose =
      dragYRef.current >= DISMISS_DISTANCE || velocityRef.current >= DISMISS_VELOCITY;
    if (shouldClose) {
      onClose();
      return;
    }
    setDragY(0);
    dragYRef.current = 0;
  }

  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      height="auto"
      destroyOnHidden
      closable={false}
      classNames={{
        wrapper: "!max-h-[min(78dvh,640px)]",
        section: "!rounded-t-[1.75rem] !overflow-hidden !border-0 !bg-app-card !p-0",
        body: "!p-0 !bg-app-card",
        header: "!hidden",
        mask: "!bg-slate-900/45 dark:!bg-black/65",
      }}
      styles={{
        wrapper: {
          borderTopLeftRadius: "1.75rem",
          borderTopRightRadius: "1.75rem",
          overflow: "hidden",
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? "none" : "transform 220ms ease-out",
          willChange: "transform",
        },
        section: {
          borderTopLeftRadius: "1.75rem",
          borderTopRightRadius: "1.75rem",
          background: "var(--card)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        },
        body: {
          background: "var(--card)",
          padding: 0,
        },
        mask: {
          backdropFilter: "blur(4px)",
          opacity: dragY > 0 ? Math.max(0.35, 1 - dragY / 280) : undefined,
          transition: dragging ? "none" : "opacity 220ms ease-out",
        },
      }}
    >
      <div className="px-4 pb-4 pt-1">
        <div
          className="touch-none select-none cursor-grab active:cursor-grabbing -mx-4 px-4 pt-2 pb-1"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="presentation"
          aria-label="برای بستن به پایین بکشید"
        >
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--muted)_28%,transparent)]" />
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-app-fg">بیشتر</div>
              <div className="text-xs text-app-muted">میانبر بخش‌ها و تنظیمات</div>
            </div>
            <Button
              type="text"
              onClick={onClose}
              onPointerDown={(e) => e.stopPropagation()}
              className="!rounded-xl !text-app-muted"
            >
              بستن
            </Button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MORE_NAV_ITEMS.map((item) => {
            const active = matchNavHref(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
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

        <div className="mt-4 grid grid-cols-2 gap-2">
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
    </Drawer>
  );
}
