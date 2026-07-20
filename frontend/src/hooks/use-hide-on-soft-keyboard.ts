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

/**
 * Below Tailwind `sm`, hide chrome when a text-like field is focused
 * (soft keyboard open). Restores on blur / leaving the breakpoint.
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
      setHidden(isSoftKeyboardField(document.activeElement));
    };

    const onFocusIn = (e: FocusEvent) => {
      window.clearTimeout(blurTimer);
      if (!isBelowSm()) {
        setHidden(false);
        return;
      }
      if (isSoftKeyboardField(e.target)) setHidden(true);
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

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return hidden;
}
