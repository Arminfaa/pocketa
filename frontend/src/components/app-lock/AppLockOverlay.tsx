"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Typography } from "antd";
import { LockOutlined, ScanOutlined } from "@ant-design/icons";
import { PinPad } from "@/components/app-lock/PinPad";
import { useBodyScrollLock } from "@/lib/body-scroll-lock";
import { useAppLockStore } from "@/stores/app-lock.store";

const { Text, Title } = Typography;

type Props = {
  open: boolean;
};

/** Full-screen unlock gate — PIN pad + optional biometric. */
export function AppLockOverlay({ open }: Props) {
  const hydrated = useAppLockStore((s) => s.hydrated);
  const enabled = useAppLockStore((s) => s.enabled);
  const pinLength = useAppLockStore((s) => s.pinLength);
  const biometricEnabled = useAppLockStore((s) => s.biometricEnabled);
  const lockoutUntil = useAppLockStore((s) => s.lockoutUntil);
  const unlockWithPin = useAppLockStore((s) => s.unlockWithPin);
  const unlockWithBiometric = useAppLockStore((s) => s.unlockWithBiometric);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockoutLabel, setLockoutLabel] = useState<string | null>(null);
  const bioTried = useRef(false);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setPin("");
      setError(null);
      setBusy(false);
      bioTried.current = false;
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !lockoutUntil) {
      setLockoutLabel(null);
      return;
    }
    function tick() {
      const left = (lockoutUntil ?? 0) - Date.now();
      if (left <= 0) {
        setLockoutLabel(null);
        return;
      }
      setLockoutLabel(`قفل موقت — ${Math.ceil(left / 1000)} ثانیه`);
    }
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, lockoutUntil]);

  useEffect(() => {
    if (!open || !hydrated || !enabled || !biometricEnabled || bioTried.current) return;
    bioTried.current = true;
    const t = window.setTimeout(() => {
      void tryBiometric();
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-prompt once per open
  }, [open, hydrated, enabled, biometricEnabled]);

  async function tryBiometric() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await unlockWithBiometric();
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  async function submitPin(nextPin: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await unlockWithPin(nextPin);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setPin("");
      return;
    }
    setPin("");
  }

  if (!open) return null;

  // Brief cover while reading lock settings — avoid flashing dashboard
  if (!hydrated) {
    return (
      <div
        className="fixed inset-0 z-[10000] bg-app-surface"
        aria-busy="true"
        aria-label="در حال بررسی قفل اپ"
        data-body-scroll-lock="1"
      />
    );
  }

  if (!enabled) return null;

  const lockedOut = Boolean(lockoutLabel);

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center px-5 bg-app-surface"
      role="dialog"
      aria-modal="true"
      aria-label="قفل اپ"
      data-body-scroll-lock="1"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--brand, #06b6d4) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="relative z-[1] flex w-full max-w-sm flex-col items-center gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-600">
          <LockOutlined className="text-2xl" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Pocketa" className="h-12 w-12 object-contain" />
        <div className="text-center">
          <Title level={4} className="!m-0 !text-app-fg">
            اپ قفل است
          </Title>
          <Text type="secondary" className="!text-sm !mt-1 !block">
            برای مشاهده اطلاعات مالی، پین را وارد کنید
          </Text>
        </div>

        <PinPad
          value={pin}
          onChange={(next) => {
            setPin(next);
            if (error) setError(null);
          }}
          onComplete={(full) => void submitPin(full)}
          disabled={busy || lockedOut}
          maxLength={pinLength || 4}
          error={lockoutLabel ?? error}
        />

        {biometricEnabled ? (
          <Button
            type="default"
            size="large"
            className="!rounded-2xl !h-11"
            icon={<ScanOutlined />}
            loading={busy}
            disabled={lockedOut}
            onClick={() => void tryBiometric()}
          >
            باز کردن با بیومتریک
          </Button>
        ) : null}
      </div>
    </div>
  );
}
