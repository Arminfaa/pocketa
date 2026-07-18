"use client";

import type { ReactNode } from "react";
import { Flex, Typography } from "antd";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

type Props = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Secondary metric aligned opposite the title (RTL: left) */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Filters / Segmented / period pickers under the title row */
  extra?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  icon,
  meta,
  actions,
  extra,
  className,
}: Props) {
  return (
    <div className={cn("w-full", className)}>
      <Flex justify="space-between" align="flex-start" gap="middle" wrap="wrap">
        <div className="min-w-0 flex-1">
          <Flex align="center" gap={12} className="min-w-0">
            {icon ? (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/15 to-brandViolet-500/15 text-xl text-brand-600 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.12)] dark:text-brand-300">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <Title level={3} className="!m-0 !text-xl !leading-tight sm:!text-2xl">
                {title}
              </Title>
              {description ? (
                <Text type="secondary" className="!mt-1 !block !text-sm !leading-relaxed">
                  {description}
                </Text>
              ) : null}
            </div>
          </Flex>
        </div>

        {(meta || actions) && (
          <Flex align="center" gap="small" wrap="wrap" className="shrink-0 ms-auto">
            {meta ? (
              <div className="rounded-2xl bg-app-card/90 px-3 py-2 shadow-soft backdrop-blur-sm">
                {meta}
              </div>
            ) : null}
            {actions}
          </Flex>
        )}
      </Flex>

      {extra ? <div className="mt-4 w-full">{extra}</div> : null}
    </div>
  );
}
