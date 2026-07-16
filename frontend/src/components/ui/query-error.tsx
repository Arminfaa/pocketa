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
    <Alert
      type="error"
      showIcon
      message="خطا"
      description={message}
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            تلاش مجدد
          </Button>
        ) : undefined
      }
    />
  );
}
