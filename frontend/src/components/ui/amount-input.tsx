"use client";

import type { KeyboardEvent } from "react";
import { Input, Typography } from "antd";
import type { InputProps } from "antd";
import {
  extractEnglishDigits,
  formatAmountInputValue,
  isAmountInputChunk,
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
 * Money input: digits only (fa/en), live thousand-separators, Persian words under field.
 * Stored display may use fa-IR digits; parseAmountInput() yields a server-ready number.
 */
export function AmountInput({
  value,
  onChange,
  showWords = true,
  className,
  dir = "ltr",
  ...rest
}: Props) {
  const display =
    value === "" || value == null ? "" : formatAmountInputValue(value);

  const numeric = parseAmountInput(display);
  const words =
    showWords && Number.isFinite(numeric) && numeric > 0
      ? tomanAmountToWords(numeric)
      : null;

  function commitDigits(raw: string) {
    if (!onChange) return;
    const digitsOnly = extractEnglishDigits(raw).slice(0, 15);
    onChange(digitsOnly ? formatAmountInputValue(digitsOnly) : "");
  }

  return (
    <div className="w-full">
      <Input
        {...rest}
        dir={dir}
        value={display}
        inputMode="numeric"
        autoComplete="off"
        className={cn("font-semibold tabular-nums", className)}
        onKeyDown={(e) => {
          if (allowControlKey(e)) return;
          if (e.key.length === 1 && !isDigitChar(e.key)) {
            e.preventDefault();
          }
        }}
        onBeforeInput={(e) => {
          const data = (e as unknown as { data?: string | null }).data;
          if (data && !isAmountInputChunk(data)) {
            e.preventDefault();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          commitDigits(e.clipboardData.getData("text"));
        }}
        onChange={(e) => commitDigits(e.target.value)}
      />
      {words ? (
        <Typography.Text type="secondary" className="mt-1 block text-xs leading-relaxed">
          {words}
        </Typography.Text>
      ) : null}
    </div>
  );
}
