"use client";

import { useLayoutEffect } from "react";

/**
 * Ref-counted body scroll lock for action sheets / overlays.
 *
 * Naive per-component `const prev = body.style.overflow; body.style.overflow =
 * "hidden"` breaks when two sheets overlap (Add ↔ More) or a sheet races with
 * Ant Design Modal: the second opener captures `"hidden"` as its previous value
 * and restores it on close, leaving the page unscrollable.
 *
 * Ant Design 6 Modals lock via injected CSS (`html body { overflow-y: hidden }`)
 * from `@rc-component/portal`. We still clear stuck *inline* styles after close.
 */

let lockCount = 0;
let savedInline: {
  overflow: string;
  overflowX: string;
  overflowY: string;
  width: string;
} | null = null;

function hasOpenOverlay() {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      [
        ".ant-modal-wrap",
        ".ant-modal-root .ant-modal",
        ".ant-image-preview-wrap",
        ".ant-drawer-open",
        '[data-body-scroll-lock="1"]',
      ].join(", "),
    ),
  );
}

function isBodyScrollStuck() {
  if (typeof document === "undefined") return false;
  const inline =
    document.body.style.overflow === "hidden" ||
    document.body.style.overflowY === "hidden";
  const classStuck = document.body.classList.contains("ant-scrolling-effect");
  if (inline || classStuck) return true;

  // Computed can stay hidden from Ant Design's injected stylesheet while a
  // Modal is open — only treat as stuck when no overlay owns the lock.
  const { overflow, overflowY } = getComputedStyle(document.body);
  return overflow === "hidden" || overflowY === "hidden";
}

function clearInlineBodyScrollStyles() {
  if (typeof document === "undefined") return;
  document.body.classList.remove("ant-scrolling-effect");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("overflow-x");
  document.body.style.removeProperty("overflow-y");
  document.body.style.removeProperty("width");
}

function acquireBodyScrollLock() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) {
    savedInline = {
      overflow: document.body.style.overflow,
      overflowX: document.body.style.overflowX,
      overflowY: document.body.style.overflowY,
      width: document.body.style.width,
    };
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    document.body.style.overflowY = "hidden";
  }
  lockCount += 1;
}

function releaseBodyScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;

  if (savedInline) {
    document.body.style.overflow = savedInline.overflow;
    document.body.style.overflowX = savedInline.overflowX;
    document.body.style.overflowY = savedInline.overflowY;
    document.body.style.width = savedInline.width;
    savedInline = null;
  }

  // If a racy Modal/sheet left inline hidden behind, drop it when nothing is open.
  if (!hasOpenOverlay()) {
    const inlineHidden =
      document.body.style.overflow === "hidden" ||
      document.body.style.overflowY === "hidden";
    if (inlineHidden || document.body.classList.contains("ant-scrolling-effect")) {
      clearInlineBodyScrollStyles();
    }
  }
}

/** Clear a stuck body scroll lock when no overlay should own it. */
export function repairBodyScrollLock() {
  if (typeof document === "undefined") return;
  if (lockCount > 0 || hasOpenOverlay()) return;
  if (!isBodyScrollStuck()) return;

  // Only strip inline/class leftovers. Ant Design's stylesheet lock is removed
  // by its own Portal cleanup; if computed is still hidden with no overlay,
  // clear inline props that may be compounding it.
  clearInlineBodyScrollStyles();
  savedInline = null;
}

/** Schedule a repair after Modal/drawer close animations settle. */
export function scheduleBodyScrollLockRepair() {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    repairBodyScrollLock();
  }, 0);
  window.setTimeout(() => {
    repairBodyScrollLock();
  }, 120);
}

/** Lock/unlock document body scroll with a process-wide refcount. */
export function useBodyScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    acquireBodyScrollLock();
    return () => {
      releaseBodyScrollLock();
      window.setTimeout(() => {
        repairBodyScrollLock();
      }, 0);
    };
  }, [locked]);
}
