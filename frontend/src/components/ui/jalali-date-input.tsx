"use client";

import { DatePicker } from "antd";
import type { DatePickerProps } from "antd";
import { normalizeJalaliDateInput } from "@/lib/amount";
import { jalaliStringToDayjs } from "@/lib/jalali-date";
import { cn } from "@/lib/cn";

type Props = Omit<DatePickerProps, "value" | "onChange" | "picker" | "format"> & {
  value?: string;
  onChange?: (value: string) => void;
};

/**
 * Ant Design DatePicker with Jalali calendar (via antd-jalali-v5 provider).
 * Emits YYYY/MM/DD with English digits for the API.
 */
export function JalaliDateInput({
  value,
  onChange,
  className,
  placeholder = "1405/04/25",
  inputReadOnly = true,
  allowClear = true,
  ...rest
}: Props) {
  return (
    <DatePicker
      {...rest}
      className={cn("w-full", className)}
      placeholder={placeholder}
      format="YYYY/MM/DD"
      inputReadOnly={inputReadOnly}
      allowClear={allowClear}
      value={jalaliStringToDayjs(value)}
      onChange={(_, dateString) =>
        onChange?.(dateString ? normalizeJalaliDateInput(String(dateString)) : "")
      }
    />
  );
}

/** Alias for clarity in new code. */
export const JalaliDatePicker = JalaliDateInput;
