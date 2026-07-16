"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button, Flex, Space, Typography } from "antd";

const FEATURES = [
  "ایمپورت پیامک بانکی",
  "بودجه و گزارش شمسی",
  "چند حساب بانکی",
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 70% 10%, rgba(6,182,212,0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 10% 90%, rgba(245,158,11,0.12), transparent 50%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(139,92,246,0.14), transparent 45%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <Flex vertical align="start" gap={24} className="md:max-w-xl">
            <Flex align="center" gap={16}>
              <Image
                src="/logo.png"
                alt="Pocketa"
                width={72}
                height={72}
                priority
                className="h-[72px] w-[72px] object-contain"
              />
              <Typography.Title level={1} className="!mb-0 !text-4xl md:!text-5xl">
                Pocketa
              </Typography.Title>
            </Flex>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
            >
              <Typography.Paragraph
                type="secondary"
                className="!mb-0 !text-lg md:!text-xl !leading-relaxed"
              >
                مدیریت مالی شخصی به فارسی — تراکنش، بودجه، و گزارش با تاریخ شمسی و تومان.
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
              <Space wrap size={[20, 8]} className="pt-2">
                {FEATURES.map((f) => (
                  <Flex key={f} align="center" gap={8}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#06b6d4]" />
                    <Typography.Text type="secondary">{f}</Typography.Text>
                  </Flex>
                ))}
              </Space>
            </motion.div>
          </Flex>
        </motion.div>
      </div>
    </main>
  );
}
