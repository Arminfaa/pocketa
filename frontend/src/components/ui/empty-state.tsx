"use client";

import { Empty } from "antd";
import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  /** retained for call-site compatibility */
  icon?: unknown;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className }: Props) {
  return (
    <div className={className}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="space-y-1">
            <div className="font-medium text-[var(--text)]">{title}</div>
            {description ? (
              <div className="text-sm text-[var(--muted)]">{description}</div>
            ) : null}
          </div>
        }
      >
        {action ? <div className="mt-2">{action}</div> : null}
      </Empty>
    </div>
  );
}
