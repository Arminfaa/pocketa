"use client";

import { useEffect, useState } from "react";

const SM_MAX = 639; // Tailwind `sm` starts at 640px

const KEYBOARD_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "tel",
  "url",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
]);

/** Modals / sheets — focusing fields here must not hide the bottom nav. */
const OVERLAY_SELECTOR = [
  ".ant-modal-wrap",
  ".ant-modal-root",
  ".app-modal-root",
  ".ant-drawer",
  ".ant-image-preview-wrap",
  '[data-body-scroll-lock="1"]',
].join(", ");

function isBelowSm() {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${SM_MAX}px)`).matches;
}

/** True for fields that typically open the soft keyboard. */
export function isSoftKeyboardField(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;

  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (!(el instanceof HTMLInputElement)) return false;
  if (el.readOnly || el.disabled) return false;

  const type = (el.getAttribute("type") || "text").toLowerCase();
  return KEYBOARD_INPUT_TYPES.has(type);
}

function isInsideOverlay(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return Boolean(el.closest(OVERLAY_SELECTOR));
}

/** Page-level text field (not inside modal/sheet) that opens the soft keyboard. */
function shouldHideBottomNav(el: EventTarget | null): boolean {
  return isSoftKeyboardField(el) && !isInsideOverlay(el);
}

/**
 * Below Tailwind `sm`, hide bottom nav only when a page-level text field is
 * focused. Inputs inside modals/sheets never hide the nav (avoids stuck-hidden
 * after closing a modal with the keyboard open).
 */
export function useHideOnSoftKeyboard() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let blurTimer: number | undefined;

    const syncFromActive = () => {
      if (!isBelowSm()) {
        setHidden(false);
        return;
      }
      setHidden(shouldHideBottomNav(document.activeElement));
    };

    const onFocusIn = (e: FocusEvent) => {
      window.clearTimeout(blurTimer);
      if (!isBelowSm()) {
        setHidden(false);
        return;
      }
      // Modal/sheet focus must restore nav if it was hidden from a page field
      if (isInsideOverlay(e.target)) {
        setHidden(false);
        return;
      }
      setHidden(shouldHideBottomNav(e.target));
    };

    const onFocusOut = () => {
      // Defer: focus often moves input → input without an idle gap.
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(syncFromActive, 80);
    };

    const onResize = () => {
      if (!isBelowSm()) setHidden(false);
      else syncFromActive();
    };

    // Modal unmount can drop focus without a reliable page-level focusin
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncFromActive();
    };

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return hidden;
}
