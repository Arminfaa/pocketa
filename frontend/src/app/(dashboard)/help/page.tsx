"use client";

import { Button, Collapse, Flex, Grid, Typography } from "antd";
import {
  PlayCircleOutlined,
  QuestionCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { HELP_TOPICS } from "@/features/tour/tour-content";
import { useTourStore } from "@/stores/tour.store";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";

const { Text, Paragraph } = Typography;
const { useBreakpoint } = Grid;

const GUIDE_ORDER = [
  "welcome",
  "dashboard",
  "transactions",
  "add",
  "reports",
  "more",
  "sidebar",
  "account-filter",
  "imports",
  "review",
  "recurring",
  "investments",
  "goals",
  "accounts",
  "categories",
  "budgets",
  "settings",
  "theme",
  "help",
] as const;

export default function HelpPage() {
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobileShell = !screens.lg;
  const user = useAuthStore((s) => s.user);
  const startTour = useTourStore((s) => s.startTour);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const topics = GUIDE_ORDER.map((id) => HELP_TOPICS.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => Boolean(t)
  );

  function onStartTour() {
    const shell = isMobileShell ? "mobile" : "desktop";
    if (shell === "desktop") setSidebarCollapsed(false);
    // Leave help so the first spotlight targets are visible on dashboard chrome
    router.push("/dashboard");
    window.setTimeout(() => {
      startTour(shell);
    }, 320);
  }

  return (
    <PageShell>
      <PageHeader
        title="راهنما"
        description="آموزش کامل بخش‌های Pocketa — بخوانید یا تور تعاملی را اجرا کنید."
        icon={<QuestionCircleOutlined />}
      />

      <SectionCard
        title="تور تعاملی"
        description="با یک دکمه، تور مناسب همین دستگاه اجرا می‌شود: در موبایل نوار پایین و شیت‌ها، در دسکتاپ منوی کناری و بخش‌ها."
      >
        <Flex vertical gap={12}>
          <Paragraph className="!mb-0 !text-app-muted">
            {user?.name
              ? `${user.name}، اگر تازه ثبت‌نام کرده‌اید تور بعد از ورود به‌صورت خودکار شروع می‌شود. هر وقت خواستید از اینجا دوباره اجرا کنید.`
              : "تور بعد از ثبت‌نام کاربر جدید به‌صورت خودکار اجرا می‌شود؛ از اینجا هم می‌توانید دوباره ببینید."}
          </Paragraph>
          <div>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={onStartTour}>
              شروع تور آموزشی
            </Button>
          </div>
        </Flex>
      </SectionCard>

      <SectionCard title="راهنمای بخش‌ها" description="روی هر مورد بزنید تا جزئیات را ببینید.">
        <Collapse
          bordered={false}
          expandIconPosition="end"
          className="bg-transparent"
          items={topics.map((topic) => ({
            key: topic.id,
            label: (
              <Flex align="center" gap={10}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/18 dark:text-brand-200">
                  {topic.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-app-fg">{topic.title}</div>
                  <Text type="secondary" className="!text-xs">
                    {topic.summary}
                  </Text>
                </div>
              </Flex>
            ),
            children: (
              <div className="space-y-2 ps-1">
                {topic.body.map((p) => (
                  <Paragraph key={p} className="!mb-0 !text-sm !leading-relaxed !text-app-muted">
                    {p}
                  </Paragraph>
                ))}
                {topic.href ? (
                  <Link
                    href={topic.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 no-underline dark:text-brand-300"
                  >
                    رفتن به این بخش
                    <RightOutlined className="rotate-180 text-[10px]" />
                  </Link>
                ) : null}
              </div>
            ),
          }))}
        />
      </SectionCard>
    </PageShell>
  );
}
