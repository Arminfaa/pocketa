"use client";

import { cn } from "@/lib/cn";

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * HH:mm picker — native time input (reliable on iOS PWA).
 *
 * Visible chrome lives on the outer shell (same width as other fields).
 * The native control is borderless inside so WebKit's intrinsic min-width
 * cannot clip or stretch the border.
 */
export function TimeInput({
  value,
  onChange,
  placeholder = "--:--",
  className,
  disabled,
  id,
}: Props) {
  return (
    <label
      className={cn(
        "app-time-input",
        "flex h-[42px] w-full min-w-0 max-w-full items-center rounded-2xl px-3",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      <input
        id={id}
        type="time"
        dir="ltr"
        disabled={disabled}
        value={value && /^\d{2}:\d{2}$/.test(value) ? value : ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="app-time-input__native min-w-0 w-full max-w-full flex-1 bg-transparent text-sm tabular-nums outline-none"
      />
    </label>
  );
}
