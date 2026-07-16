"use client";

import type { KeyboardEvent } from "react";
import { Input } from "antd";
import type { InputProps } from "antd";
import { isDigitChar, normalizeJalaliDateInput } from "@/lib/amount";
import { cn } from "@/lib/cn";

type Props = Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> & {
  value?: string;
  onChange?: (value: string) => void;
};

function allowControlKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  return [
    "Backspace",
    "Delete",
    "Tab",
    "Escape",
    "Enter",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "/",
  ].includes(e.key);
}

/**
 * Jalali date field (YYYY/MM/DD). Digits + `/` only; Persian/Arabic digits
 * are normalized to English so the value is always server-ready.
 */
export function JalaliDateInput({
  value,
  onChange,
  className,
  dir = "ltr",
  placeholder = "1405/04/25",
  ...rest
}: Props) {
  return (
    <Input
      {...rest}
      dir={dir}
      placeholder={placeholder}
      value={value ?? ""}
      inputMode="numeric"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      onKeyDown={(e) => {
        if (allowControlKey(e)) return;
        if (e.key.length === 1 && !isDigitChar(e.key) && e.key !== "/") {
          e.preventDefault();
        }
      }}
      onBeforeInput={(e) => {
        const data = (e as unknown as { data?: string | null }).data;
        if (data && !/^[0-9۰-۹٠-٩/]+$/.test(data)) {
          e.preventDefault();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        onChange?.(normalizeJalaliDateInput(e.clipboardData.getData("text")));
      }}
      onChange={(e) => onChange?.(normalizeJalaliDateInput(e.target.value))}
    />
  );
}
