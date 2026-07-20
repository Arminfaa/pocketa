"use client";

import { useEffect } from "react";

const OPEN_POPUP_SELECTOR = [
  ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
  ".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)",
  ".ant-dropdown:not(.ant-dropdown-hidden)",
  ".ant-cascader-dropdown:not(.ant-select-dropdown-hidden)",
  ".market-ticker-dropdown",
].join(", ");

const INSIDE_POPUP_SELECTOR = [
  ".ant-select-dropdown",
  ".ant-picker-dropdown",
  ".ant-dropdown",
  ".ant-cascader-dropdown",
  ".market-ticker-dropdown",
  ".rc-virtual-list",
].join(", ");

function hasOpenPopup() {
  return Boolean(document.querySelector(OPEN_POPUP_SELECTOR));
}

function isInsidePopup(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INSIDE_POPUP_SELECTOR));
}

/**
 * While an Ant Design select/picker dropdown is open, stop scroll chaining
 * to the page behind (especially on mobile touch overscroll).
 */
export function DropdownScrollLock() {
  useEffect(() => {
    const blockPageScroll = (e: TouchEvent | WheelEvent) => {
      if (!hasOpenPopup()) return;
      if (isInsidePopup(e.target)) return;
      e.preventDefault();
    };

    document.addEventListener("touchmove", blockPageScroll, { passive: false });
    document.addEventListener("wheel", blockPageScroll, { passive: false });

    return () => {
      document.removeEventListener("touchmove", blockPageScroll);
      document.removeEventListener("wheel", blockPageScroll);
    };
  }, []);

  return null;
}
