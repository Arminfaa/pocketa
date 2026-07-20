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

/** HH:mm picker — native time input (reliable on iOS PWA). */
export function TimeInput({
  value,
  onChange,
  placeholder = "--:--",
  className,
  disabled,
  id,
}: Props) {
  return (
    // Native time controls have a large intrinsic min-width on WebKit;
    // clamp the wrapper so modal columns don't overflow horizontally.
    <div className="min-w-0 w-full max-w-full overflow-hidden">
      <input
        id={id}
        type="time"
        dir="ltr"
        disabled={disabled}
        value={value && /^\d{2}:\d{2}$/.test(value) ? value : ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "ant-input box-border block min-w-0 w-full max-w-full px-3 py-2 text-sm tabular-nums",
          "rounded-2xl outline-none",
          className
        )}
        style={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
      />
    </div>
  );
}
