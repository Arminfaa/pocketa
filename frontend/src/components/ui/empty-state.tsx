import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-[var(--border)] p-10 text-center",
        className
      )}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]">
        <Icon size={22} />
      </div>
      <div className="font-medium text-[var(--text)]">{title}</div>
      {description ? (
        <p className="mt-1 text-sm text-[var(--muted)] max-w-md mx-auto">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
