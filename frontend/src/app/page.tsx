"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, Flex, Space, Typography } from "antd";

const FEATURES = [
  "📩 ایمپورت پیامک‌های بانکی",
  "📈 بودجه‌بندی و گزارش‌های پیشرفته",
  "🏦 مدیریت چند حساب، کارت و کیف پول",
];

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_70%_10%,rgba(6,182,212,0.22),transparent_55%),radial-gradient(ellipse_70%_50%_at_10%_90%,rgba(245,158,11,0.12),transparent_50%),radial-gradient(ellipse_50%_40%_at_90%_80%,rgba(139,92,246,0.14),transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] bg-[length:48px_48px]"
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
        <div className="flex flex-1 flex-col justify-center py-16 md:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <Flex vertical align="start" gap={24} className="md:max-w-2xl lg:max-w-3xl">
              <Flex align="center" gap={16}>
                <Image
                  src="/logo.png"
                  alt="Pocketa"
                  width={72}
                  height={72}
                  priority
                  className="h-[72px] w-[72px] object-contain"
                />
                <Typography.Text className="!text-2xl md:!text-3xl !font-semibold">
                  Pocketa
                </Typography.Text>
              </Flex>

              <Typography.Title level={1} className="!mb-0 !text-3xl md:!text-4xl !leading-snug">
                همه چیز برای مدیریت هوشمند امور مالی شخصی
              </Typography.Title>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.4 }}
              >
                <Typography.Paragraph
                  type="secondary"
                  className="!mb-0 !text-lg md:!text-xl !leading-relaxed"
                >
                  از ثبت تراکنش و دسته‌بندی هزینه‌ها تا بودجه‌بندی، اهداف پس‌انداز، مدیریت
                  سرمایه‌گذاری و گزارش‌های تحلیلی؛ همه در یک پلتفرم فارسی.
                </Typography.Paragraph>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.4 }}
              >
                <Space wrap size="middle">
                  <Link href="/register">
                    <Button type="primary" size="large">
                      شروع رایگان
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="large">ورود</Button>
                  </Link>
                </Space>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35, duration: 0.45 }}
              >
                <Flex vertical gap={10} className="pt-2">
                  {FEATURES.map((f) => (
                    <Typography.Text key={f} type="secondary" className="!text-base">
                      {f}
                    </Typography.Text>
                  ))}
                </Flex>
              </motion.div>
            </Flex>
          </motion.div>
        </div>

        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="border-t border-app-border py-5"
        >
          <Typography.Paragraph
            type="secondary"
            className="!mb-0 !text-sm !leading-relaxed"
            dir="ltr"
          >
            © All rights reserved for{" "}
            <a
              href="https://arminfatehi.ir/en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 no-underline transition-colors hover:text-brand-500 dark:text-brand-300 dark:hover:text-brand-200"
            >
              Armin Fatehi
            </a>
          </Typography.Paragraph>
        </motion.footer>
      </div>
    </main>
  );
}
