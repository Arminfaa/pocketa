"use client";

import { Input, Typography } from "antd";
import type { InputProps } from "antd";
import {
  formatAmountInputValue,
  parseAmountInput,
  tomanAmountToWords,
  toEnglishDigits,
} from "@/lib/amount";
import { cn } from "@/lib/cn";

type Props = Omit<InputProps, "value" | "onChange" | "type"> & {
  value?: string | number;
  onChange?: (value: string) => void;
  /** Show Persian words under the field (default true). */
  showWords?: boolean;
};

/**
 * Money input with live thousand-separators (fa-IR) and Persian words underneath.
 * Compatible with Ant Design Form.Item (value / onChange string API).
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
    value === "" || value == null
      ? ""
      : formatAmountInputValue(value);

  const numeric = parseAmountInput(display);
  const words =
    showWords && Number.isFinite(numeric) && numeric > 0
      ? tomanAmountToWords(numeric)
      : null;

  function handleChange(raw: string) {
    if (!onChange) return;
    const english = toEnglishDigits(raw);
    const digitsOnly = english.replace(/\D/g, "");
    if (!digitsOnly) {
      onChange("");
      return;
    }
    // Cap to a safe integer length for تومان amounts
    const clipped = digitsOnly.slice(0, 15);
    onChange(formatAmountInputValue(clipped));
  }

  return (
    <div className="w-full">
      <Input
        {...rest}
        dir={dir}
        value={display}
        className={cn("font-semibold tabular-nums", className)}
        onChange={(e) => handleChange(e.target.value)}
      />
      {words ? (
        <Typography.Text type="secondary" className="mt-1 block text-xs leading-relaxed">
          {words}
        </Typography.Text>
      ) : null}
    </div>
  );
}
