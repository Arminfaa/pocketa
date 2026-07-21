"use client";

import {
  CodeOutlined,
  EnvironmentOutlined,
  GithubOutlined,
  GlobalOutlined,
  LinkedinOutlined,
  MailOutlined,
  PhoneOutlined,
  ProjectOutlined,
  RocketOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { Flex, Typography } from "antd";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { PageShell } from "@/components/ui/page-shell";
import { SectionCard } from "@/components/ui/section-card";
import { SoftAvatar, SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";

const { Paragraph, Text } = Typography;

const BIO = [
  "من آرمین فاتحی، توسعه‌دهنده فرانت‌اند با بیش از ۶ سال تجربه در طراحی و توسعه وب‌اپلیکیشن‌های مدرن هستم. تمرکز اصلی من روی ساخت نرم‌افزارهای سریع، مقیاس‌پذیر و کاربرمحور با استفاده از React، Next.js و TypeScript است.",
  "Pocketa حاصل علاقه من به ساخت ابزارهایی است که بتوانند زندگی روزمره را ساده‌تر کنند. هدف من از توسعه این پروژه، ارائه یک سامانه مدیریت مالی شخصی کاملاً فارسی است که مدیریت درآمد، هزینه، بودجه و حساب‌های بانکی را برای کاربران آسان و لذت‌بخش کند.",
  "در طول مسیر حرفه‌ای خود با شرکت‌ها و پروژه‌های مختلفی در حوزه سیستم‌های سازمانی، ERP، کتابخانه دیجیتال و سامانه‌های مدیریت رویداد همکاری کرده‌ام. این تجربه‌ها باعث شده هنگام توسعه محصولات، علاوه بر زیبایی رابط کاربری، به کیفیت کد، عملکرد، امنیت و تجربه کاربری نیز توجه ویژه‌ای داشته باشم.",
  "من اعتقاد دارم بهترین نرم‌افزارها زمانی ساخته می‌شوند که یادگیری هیچ‌وقت متوقف نشود؛ به همین دلیل همیشه در حال یادگیری فناوری‌های جدید و بهبود مهارت‌هایم هستم.",
] as const;

const CONTACTS = [
  {
    key: "web",
    title: "وب‌سایت",
    value: "arminfatehi.ir",
    href: "https://arminfatehi.ir",
    icon: <GlobalOutlined />,
    color: "#06b6d4",
  },
  {
    key: "email",
    title: "ایمیل",
    value: "arminfaa@gmail.com",
    href: "mailto:arminfaa@gmail.com",
    icon: <MailOutlined />,
    color: "#8b5cf6",
  },
  {
    key: "linkedin",
    title: "LinkedIn",
    value: "armin-fatehi",
    href: "https://www.linkedin.com/in/armin-fatehi-366b64260/",
    icon: <LinkedinOutlined />,
    color: "#0a66c2",
  },
  {
    key: "github",
    title: "GitHub",
    value: "Arminfaa",
    href: "https://github.com/Arminfaa",
    icon: <GithubOutlined />,
    color: "#64748b",
  },
  {
    key: "phone",
    title: "شماره تماس",
    value: "09138301272",
    href: "tel:+989138301272",
    icon: <PhoneOutlined />,
    color: "#10b981",
  },
] as const;

const STATS = [
  {
    label: "تجربه",
    value: "۶+ سال",
    icon: <TrophyOutlined />,
    tone: "brand" as const,
  },
  {
    label: "پروژه حرفه‌ای",
    value: "۱۲+",
    icon: <RocketOutlined />,
    tone: "violet" as const,
  },
  {
    label: "مهارت تخصصی",
    value: "۲۴",
    icon: <ProjectOutlined />,
    tone: "success" as const,
  },
  {
    label: "همکاری شرکتی",
    value: "۳",
    icon: <TeamOutlined />,
    tone: "warning" as const,
  },
] as const;

export default function AboutDeveloperPage() {
  return (
    <PageShell width="wide">
      <PageHeader
        title="درباره توسعه‌دهنده"
        description="آرمین فاتحی — سازنده Pocketa"
        icon={<CodeOutlined />}
      />

      <SectionCard>
        <Flex vertical gap={16}>
          <div>
            <Text className="!block !text-xl !font-semibold !text-app-fg sm:!text-2xl">
              آرمین فاتحی
            </Text>
            <Text type="secondary" className="!mt-1.5 !block !text-sm sm:!text-base">
              توسعه‌دهنده فرانت‌اند | React • Next.js • TypeScript
            </Text>
            <Flex align="center" gap={6} className="mt-3 text-app-muted">
              <EnvironmentOutlined className="text-brand-600 dark:text-brand-300" />
              <Text type="secondary" className="!text-sm">
                ایران
              </Text>
            </Flex>
          </div>

          <div className="space-y-3">
            {BIO.map((paragraph) => (
              <Paragraph
                key={paragraph.slice(0, 24)}
                className="!mb-0 !text-sm !leading-relaxed !text-app-muted sm:!text-[15px]"
              >
                {paragraph}
              </Paragraph>
            ))}
          </div>
        </Flex>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {STATS.map((stat) => (
          <KpiCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            size="sm"
          />
        ))}
      </div>

      <SoftList
        header={
          <div>
            <div className="text-sm font-semibold text-app-fg">اطلاعات تماس</div>
            <div className="mt-0.5 text-xs text-app-muted">
              از این راه‌ها می‌توانید با من در ارتباط باشید.
            </div>
          </div>
        }
      >
        {CONTACTS.map((item) => (
          <SoftListItem
            key={item.key}
            className="hover:bg-brand-500/[0.05] active:bg-brand-500/[0.08]"
          >
            <a
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="block text-inherit no-underline"
            >
              <SoftListRow
                leading={<SoftAvatar color={item.color}>{item.icon}</SoftAvatar>}
                title={item.title}
                subtitle={<span dir="ltr">{item.value}</span>}
              />
            </a>
          </SoftListItem>
        ))}
      </SoftList>
    </PageShell>
  );
}
