"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

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
          className="flex flex-col items-start gap-6 md:max-w-xl"
        >
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="Pocketa"
              width={72}
              height={72}
              priority
              className="h-[72px] w-[72px] object-contain"
            />
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--text)]">
              Pocketa
            </h1>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.4 }}
            className="text-lg md:text-xl text-[var(--muted)] leading-relaxed"
          >
            مدیریت مالی شخصی به فارسی — تراکنش، بودجه، و گزارش با تاریخ شمسی و تومان.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.4 }}
            className="flex flex-wrap gap-3"
          >
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-brand-500 text-white py-3 px-6 font-medium hover:opacity-95"
            >
              شروع رایگان
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-transparent py-3 px-6 hover:bg-white/5"
            >
              ورود
            </Link>
          </motion.div>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.45 }}
            className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)] pt-2"
          >
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                {f}
              </li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </main>
  );
}
