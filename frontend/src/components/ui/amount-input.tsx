"use client";

import type { KeyboardEvent } from "react";
import { Input, Typography } from "antd";
import type { InputProps } from "antd";
import {
  extractDecimalAmountString,
  extractEnglishDigits,
  formatAmountInputValue,
  formatDecimalAmountInputValue,
  isAmountInputChunk,
  isDecimalAmountInputChunk,
  isDecimalSeparatorChar,
  isDigitChar,
  parseAmountInput,
  tomanAmountToWords,
} from "@/lib/amount";
import { cn } from "@/lib/cn";

type Props = Omit<InputProps, "value" | "onChange" | "type" | "inputMode"> & {
  value?: string | number;
  onChange?: (value: string) => void;
  /** Show Persian words under the field (default true). */
  showWords?: boolean;
  /** Allow fractional values (e.g. 42.980 grams). */
  allowDecimals?: boolean;
  /** Max digits after decimal when allowDecimals (default 3). */
  decimalPlaces?: number;
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
 * Money/quantity input: digits (fa/en).
 * Default: integer toman with thousand-separators + Persian words.
 * With allowDecimals: fractional quantities like ۴۲٫۹۸۰
 */
export function AmountInput({
  value,
  onChange,
  showWords = true,
  allowDecimals = false,
  decimalPlaces = 3,
  className,
  dir = "ltr",
  ...rest
}: Props) {
  const display =
    value === "" || value == null
      ? ""
      : allowDecimals
        ? formatDecimalAmountInputValue(value, decimalPlaces)
        : formatAmountInputValue(value);

  const numeric = parseAmountInput(display);
  const words =
    !allowDecimals && showWords && Number.isFinite(numeric) && numeric > 0
      ? tomanAmountToWords(numeric)
      : null;

  function commitRaw(raw: string) {
    if (!onChange) return;
    if (allowDecimals) {
      const normalized = extractDecimalAmountString(raw, decimalPlaces);
      onChange(normalized ? formatDecimalAmountInputValue(normalized, decimalPlaces) : "");
      return;
    }
    const digitsOnly = extractEnglishDigits(raw).slice(0, 15);
    onChange(digitsOnly ? formatAmountInputValue(digitsOnly) : "");
  }

  return (
    <div className="w-full">
      <Input
        {...rest}
        dir={dir}
        value={display}
        inputMode={allowDecimals ? "decimal" : "numeric"}
        autoComplete="off"
        className={cn("font-semibold tabular-nums", className)}
        onKeyDown={(e) => {
          if (allowControlKey(e)) return;
          if (allowDecimals && isDecimalSeparatorChar(e.key)) {
            if (display.includes(".") || display.includes("٫")) {
              e.preventDefault();
            }
            return;
          }
          if (e.key.length === 1 && !isDigitChar(e.key)) {
            e.preventDefault();
          }
        }}
        onBeforeInput={(e) => {
          const data = (e as unknown as { data?: string | null }).data;
          if (!data) return;
          if (allowDecimals) {
            if (!isDecimalAmountInputChunk(data)) e.preventDefault();
            return;
          }
          if (!isAmountInputChunk(data)) e.preventDefault();
        }}
        onPaste={(e) => {
          e.preventDefault();
          commitRaw(e.clipboardData.getData("text"));
        }}
        onChange={(e) => commitRaw(e.target.value)}
      />
      {words ? (
        <Typography.Text type="secondary" className="mt-1 block text-xs leading-relaxed">
          {words}
        </Typography.Text>
      ) : null}
    </div>
  );
}
