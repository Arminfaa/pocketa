"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightOutlined, HomeOutlined, AppstoreOutlined } from "@ant-design/icons";
import { Button, Flex, Space, Typography } from "antd";

export default function NotFoundPage() {
  const router = useRouter();

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

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -start-24 top-1/4 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl"
        animate={{ y: [0, 18, 0], opacity: [0.45, 0.7, 0.45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -end-16 bottom-1/4 h-56 w-56 rounded-full bg-brandViolet-500/15 blur-3xl"
        animate={{ y: [0, -16, 0], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="flex w-full flex-col items-center"
        >
          <Flex align="center" gap={12} className="mb-10">
            <Image
              src="/logo.webp"
              alt="Pocketa"
              width={48}
              height={48}
              priority
              className="h-12 w-12 object-contain"
            />
            <Typography.Text className="!text-xl !font-semibold tracking-tight">
              Pocketa
            </Typography.Text>
          </Flex>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.5, ease: "easeOut" }}
            className="relative mb-6"
          >
            <Typography.Title
              level={1}
              className="!m-0 !bg-brand-accent !bg-clip-text !text-[7.5rem] !font-black !leading-none !tracking-tighter !text-transparent sm:!text-[9rem]"
              aria-hidden
            >
              404
            </Typography.Title>
            <motion.div
              aria-hidden
              className="absolute inset-x-8 -bottom-1 h-3 rounded-full bg-brand-accent/30 blur-md"
              animate={{ opacity: [0.35, 0.7, 0.35], scaleX: [0.92, 1, 0.92] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
          >
            <Typography.Title level={2} className="!mb-3 !mt-2 !text-2xl !font-bold sm:!text-3xl">
              این صفحه پیدا نشد
            </Typography.Title>
            <Typography.Paragraph
              type="secondary"
              className="!mx-auto !mb-8 !max-w-md !text-base !leading-relaxed sm:!text-lg"
            >
              آدرسی که وارد کردید وجود ندارد یا جابه‌جا شده. نگران نباشید — کیف پولتان هنوز سر جایش
              است.
            </Typography.Paragraph>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4 }}
          >
            <Space wrap size="middle" className="justify-center">
              <Link href="/">
                <Button type="primary" size="large" icon={<HomeOutlined />}>
                  صفحه اصلی
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="large" icon={<AppstoreOutlined />}>
                  داشبورد
                </Button>
              </Link>
              <Button
                size="large"
                type="text"
                icon={<ArrowRightOutlined />}
                onClick={() => router.back()}
                className="!text-app-muted hover:!text-brand-600"
              >
                بازگشت
              </Button>
            </Space>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}
