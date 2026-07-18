"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, Drawer } from "antd";
import { BulbOutlined, LogoutOutlined } from "@ant-design/icons";
import { MORE_NAV_ITEMS, matchNavHref } from "./nav-items";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function MoreActionSheet({
  open,
  onClose,
  mode,
  onToggleTheme,
  onLogout,
  loggingOut,
}: Props) {
  const pathname = usePathname();

  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      height="auto"
      destroyOnHidden
      closable={false}
      classNames={{
        wrapper: "!max-h-[min(78dvh,640px)]",
        section: "!rounded-t-[1.75rem] !overflow-hidden !border-0 !bg-app-card !p-0",
        body: "!p-0 !bg-app-card",
        header: "!hidden",
        mask: "!bg-slate-900/45 dark:!bg-black/65",
      }}
      styles={{
        wrapper: {
          borderTopLeftRadius: "1.75rem",
          borderTopRightRadius: "1.75rem",
          overflow: "hidden",
        },
        section: {
          borderTopLeftRadius: "1.75rem",
          borderTopRightRadius: "1.75rem",
          background: "var(--card)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        },
        body: {
          background: "var(--card)",
          padding: 0,
        },
        mask: {
          backdropFilter: "blur(4px)",
        },
      }}
    >
      <div className="px-4 pb-4 pt-3">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--muted)_28%,transparent)]" />

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-app-fg">بیشتر</div>
            <div className="text-xs text-app-muted">میانبر بخش‌ها و تنظیمات</div>
          </div>
          <Button type="text" onClick={onClose} className="!rounded-xl !text-app-muted">
            بستن
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MORE_NAV_ITEMS.map((item) => {
            const active = matchNavHref(pathname, item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors",
                  active
                    ? "bg-brand-500/12 text-brand-600 dark:text-brand-300"
                    : "bg-[color-mix(in_srgb,var(--muted)_7%,transparent)] text-app-fg hover:bg-brand-500/8"
                )}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="text-[11px] font-medium leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            block
            size="large"
            icon={<BulbOutlined />}
            onClick={onToggleTheme}
            className="!h-12"
          >
            {mode === "dark" ? "حالت روشن" : "حالت تاریک"}
          </Button>
          <Button
            block
            size="large"
            danger
            icon={<LogoutOutlined />}
            onClick={onLogout}
            loading={loggingOut}
            className="!h-12"
          >
            خروج
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
