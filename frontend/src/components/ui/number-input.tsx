"use client";

import type { KeyboardEvent } from "react";
import { Input } from "antd";
import type { InputProps } from "antd";
import {
  extractEnglishDigits,
  isDigitChar,
  isDigitOnlyChunk,
  toPersianDigits,
} from "@/lib/amount";
import { cn } from "@/lib/cn";

type Props = Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> & {
  value?: number | null;
  onChange?: (value: number | null) => void;
  min?: number;
  max?: number;
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
  ].includes(e.key);
}

/**
 * Integer-only input. Accepts Persian/English digits, rejects letters,
 * emits a JS number (English/server-ready) via onChange.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  className,
  dir = "ltr",
  ...rest
}: Props) {
  const display =
    value === null || value === undefined || !Number.isFinite(value)
      ? ""
      : toPersianDigits(String(Math.trunc(value)));

  function commit(raw: string, clamp: boolean) {
    if (!onChange) return;
    const digits = extractEnglishDigits(raw).slice(0, 12);
    if (!digits) {
      onChange(null);
      return;
    }
    let n = Number(digits);
    if (!Number.isFinite(n)) {
      onChange(null);
      return;
    }
    if (clamp) {
      if (min !== undefined && n < min) n = min;
      if (max !== undefined && n > max) n = max;
    }
    onChange(n);
  }

  return (
    <Input
      {...rest}
      dir={dir}
      value={display}
      inputMode="numeric"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      onKeyDown={(e) => {
        if (allowControlKey(e)) return;
        if (e.key.length === 1 && !isDigitChar(e.key)) {
          e.preventDefault();
        }
      }}
      onBeforeInput={(e) => {
        const data = (e as unknown as { data?: string | null }).data;
        if (data && !isDigitOnlyChunk(data)) {
          e.preventDefault();
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        commit(e.clipboardData.getData("text"), true);
      }}
      onChange={(e) => commit(e.target.value, false)}
      onBlur={() => {
        if (value !== null && value !== undefined && Number.isFinite(value)) {
          commit(String(value), true);
        }
      }}
    />
  );
}
