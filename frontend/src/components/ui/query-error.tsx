"use client";

import { Alert, Button } from "antd";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function QueryError({
  message = "خطا در دریافت اطلاعات. لطفاً دوباره تلاش کنید.",
  onRetry,
}: Props) {
  return (
    <div className="surface-card overflow-hidden !border-red-500/20">
      <Alert
        type="error"
        showIcon
        className="!border-0 !bg-transparent !rounded-none"
        title="خطا"
        description={message}
        action={
          onRetry ? (
            <Button size="small" onClick={onRetry}>
              تلاش مجدد
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
