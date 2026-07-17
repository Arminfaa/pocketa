"use client";

import type { KeyboardEvent } from "react";
import { Input } from "antd";
import type { InputProps } from "antd";
import { toEnglishDigits } from "@/lib/amount";
import { cn } from "@/lib/cn";

type Props = Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> & {
  value?: string;
  onChange?: (value: string) => void;
  /** Max decimal places (default 6). */
  maxDecimals?: number;
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
    ".",
  ].includes(e.key);
}

export function parseDecimalInput(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : NaN;
  if (raw == null || raw === "") return NaN;
  const cleaned = toEnglishDigits(String(raw))
    .replace(/[,\u066C\u060C\u200E\u200F\s]/g, "")
    .replace(/٫/g, ".")
    .trim();
  if (!cleaned || cleaned === ".") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** Format a decimal for display (English digits, trimmed trailing zeros). */
export function formatDecimalInputValue(
  value: number | null | undefined,
  maxDecimals = 6
): string {
  if (value == null || !Number.isFinite(value)) return "";
  const fixed = value.toFixed(maxDecimals).replace(/\.?0+$/, "");
  return fixed;
}

/**
 * Decimal quantity input (grams, mesghal, USD count).
 * Accepts Persian/English digits and a single decimal point.
 */
export function DecimalInput({
  value,
  onChange,
  className,
  dir = "ltr",
  maxDecimals = 6,
  ...rest
}: Props) {
  function commit(raw: string) {
    if (!onChange) return;
    let english = toEnglishDigits(raw).replace(/٫/g, ".");
    english = english.replace(/[^\d.]/g, "");
    const parts = english.split(".");
    if (parts.length > 2) {
      english = `${parts[0]}.${parts.slice(1).join("")}`;
    }
    if (parts[1] && parts[1].length > maxDecimals) {
      english = `${parts[0]}.${parts[1].slice(0, maxDecimals)}`;
    }
    onChange(english);
  }

  return (
    <Input
      {...rest}
      dir={dir}
      value={value ?? ""}
      inputMode="decimal"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      onKeyDown={(e) => {
        if (allowControlKey(e)) return;
        if (e.key.length === 1 && !/[0-9۰-۹٠-٩]/.test(e.key) && e.key !== ".") {
          e.preventDefault();
        }
      }}
      onChange={(e) => commit(e.target.value)}
      onPaste={(e) => {
        e.preventDefault();
        commit(e.clipboardData.getData("text"));
      }}
    />
  );
}
