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
      className={cn("finance-type-toggle flex w-full", className)}
      {...props}
    >
      {withAll ? (
        <Radio.Button value="all" className="finance-type-all flex-1 text-center">
          همه
        </Radio.Button>
      ) : null}
      <Radio.Button value="expense" className="finance-type-expense flex-1 text-center">
        هزینه
      </Radio.Button>
      <Radio.Button value="income" className="finance-type-income flex-1 text-center">
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
