"use client";

import { Radio } from "antd";
import type { RadioGroupProps } from "antd";
import { cn } from "@/lib/cn";

type Props = Omit<RadioGroupProps, "options" | "optionType" | "buttonStyle"> & {
  className?: string;
  /** Include "all" option for filters */
  withAll?: boolean;
};

/**
 * Income = green, expense = red. Used for transaction / recurring / category type picks.
 */
export function FinanceTypeToggle({ className, withAll = false, ...props }: Props) {
  return (
    <Radio.Group
      optionType="button"
      buttonStyle="solid"
      block
      className={cn("finance-type-toggle w-full", className)}
      {...props}
    >
      {withAll ? (
        <Radio.Button value="all" className="finance-type-all">
          همه
        </Radio.Button>
      ) : null}
      <Radio.Button value="expense" className="finance-type-expense">
        هزینه
      </Radio.Button>
      <Radio.Button value="income" className="finance-type-income">
        درآمد
      </Radio.Button>
    </Radio.Group>
  );
}

export function financeTypeTextClass(type: "income" | "expense"): string {
  return type === "income" ? "text-emerald-500" : "text-red-500";
}

export const FINANCE_COLORS = {
  income: "#10b981",
  expense: "#ef4444",
} as const;
