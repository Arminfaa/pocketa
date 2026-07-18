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
          <Flex align="center" gap="small" className="min-w-0">
            {icon ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-lg text-brand-600 dark:text-brand-300">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <Title level={4} className="!m-0 !leading-tight">
                {title}
              </Title>
              {description ? (
                <Text type="secondary" className="!mt-1 !block !text-sm">
                  {description}
                </Text>
              ) : null}
            </div>
          </Flex>
        </div>

        {(meta || actions) && (
          <Flex
            align="center"
            gap="small"
            wrap="wrap"
            className="shrink-0 ms-auto"
          >
            {meta}
            {actions}
          </Flex>
        )}
      </Flex>

      {extra ? <div className="mt-3 w-full">{extra}</div> : null}
    </div>
  );
}
