"use client";

import { useEffect, useState } from "react";
import { Button, Typography } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { cn } from "@/lib/cn";
import { PIN_MAX_LENGTH } from "@/lib/app-lock/types";
import { toPersianDigits } from "@/lib/format";

const { Text } = Typography;

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Called when `value` reaches `maxLength`. */
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  maxLength?: number;
  error?: string | null;
  className?: string;
};

/** Numeric PIN pad with Persian digit display. */
export function PinPad({
  value,
  onChange,
  onComplete,
  disabled,
  maxLength = PIN_MAX_LENGTH,
  error,
  className,
}: Props) {
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!error) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), 420);
    return () => window.clearTimeout(t);
  }, [error]);

  function press(key: (typeof KEYS)[number]) {
    if (disabled || key === "") return;
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length >= maxLength) return;
    const next = value + key;
    onChange(next);
    if (next.length === maxLength && onComplete) {
      onComplete(next);
    }
  }

  const slots = Math.min(Math.max(maxLength, 4), PIN_MAX_LENGTH);

  return (
    <div className={cn("w-full max-w-[280px] mx-auto", className)}>
      <div
        className={cn(
          "flex items-center justify-center gap-2.5 min-h-8 mb-2",
          shake && "animate-[app-lock-shake_0.4s_ease-in-out]"
        )}
        aria-live="polite"
      >
        {Array.from({ length: slots }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-3 rounded-full border-2 transition-colors",
              i < value.length
                ? "border-brand-500 bg-brand-500"
                : "border-[color-mix(in_srgb,var(--muted)_45%,transparent)] bg-transparent"
            )}
          />
        ))}
      </div>
      {error ? (
        <Text type="danger" className="!text-xs !block text-center mb-3">
          {error}
        </Text>
      ) : (
        <div className="h-5 mb-3" />
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((key, idx) => {
          if (key === "") return <div key={`empty-${idx}`} />;
          if (key === "back") {
            return (
              <Button
                key="back"
                type="text"
                disabled={disabled || value.length === 0}
                className="!h-14 !rounded-2xl !text-lg !bg-app-card/80"
                icon={<DeleteOutlined />}
                onClick={() => press("back")}
                aria-label="پاک کردن"
              />
            );
          }
          return (
            <Button
              key={key}
              type="text"
              disabled={disabled}
              className="!h-14 !rounded-2xl !text-xl !font-semibold !bg-app-card/80 !text-app-fg"
              onClick={() => press(key)}
            >
              {toPersianDigits(key)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
