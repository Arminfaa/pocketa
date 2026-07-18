"use client";

import type { ReactNode } from "react";
import { Flex } from "antd";
import { cn } from "@/lib/cn";

const WIDTH = {
  full: "w-full",
  form: "w-full max-w-3xl",
  narrow: "w-full max-w-xl",
  wide: "w-full max-w-4xl",
} as const;

export type PageShellWidth = keyof typeof WIDTH;

type Props = {
  children: ReactNode;
  width?: PageShellWidth;
  className?: string;
  gap?: "middle" | "large";
};

/** Consistent vertical page layout for the modern PWA shell. */
export function PageShell({
  children,
  width = "full",
  className,
  gap = "large",
}: Props) {
  return (
    <Flex vertical gap={gap} className={cn(WIDTH[width], className)}>
      {children}
    </Flex>
  );
}
