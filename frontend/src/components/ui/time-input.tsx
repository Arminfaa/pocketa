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
 * Absolutely fills a width-clamped shell so WebKit's intrinsic min-width
 * cannot expand the parent (modal overflow / wider-than-siblings).
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
    <div
      className={cn(
        "relative isolate w-full min-w-0 max-w-full overflow-hidden",
        "h-[42px] rounded-2xl"
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
        className={cn(
          "ant-input absolute inset-0 box-border m-0 h-full max-h-full",
          "min-w-0 w-full max-w-full px-3 py-0 text-sm tabular-nums leading-none",
          "rounded-2xl outline-none",
          className
        )}
      />
    </div>
  );
}
