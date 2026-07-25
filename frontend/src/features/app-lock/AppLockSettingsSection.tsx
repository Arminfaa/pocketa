"use client";

import { useState } from "react";
import { App, Button, Flex, Input, Modal, Select, Space, Switch, Tag, Typography } from "antd";
import {
  LockOutlined,
  SafetyCertificateOutlined,
  ScanOutlined,
} from "@ant-design/icons";
import { SectionCard } from "@/components/ui/section-card";
import { PinPad } from "@/components/app-lock/PinPad";
import { GRACE_PERIOD_OPTIONS, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/app-lock/types";
import { isValidPinFormat } from "@/lib/app-lock/crypto";
import { useAppLockStore } from "@/stores/app-lock.store";
import { useAuthStore } from "@/stores/auth.store";

const { Text } = Typography;

type PinModalMode = "enable" | "change" | "disable" | "bio-enable" | "bio-disable" | null;

export function AppLockSettingsSection() {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);

  const enabled = useAppLockStore((s) => s.enabled);
  const biometricEnabled = useAppLockStore((s) => s.biometricEnabled);
  const biometricAvailable = useAppLockStore((s) => s.biometricAvailable);
  const gracePeriodSec = useAppLockStore((s) => s.gracePeriodSec);
  const pinLength = useAppLockStore((s) => s.pinLength);
  const enableWithPin = useAppLockStore((s) => s.enableWithPin);
  const changePin = useAppLockStore((s) => s.changePin);
  const disable = useAppLockStore((s) => s.disable);
  const setGracePeriod = useAppLockStore((s) => s.setGracePeriod);
  const enableBiometric = useAppLockStore((s) => s.enableBiometric);
  const disableBiometric = useAppLockStore((s) => s.disableBiometric);
  const lockNow = useAppLockStore((s) => s.lockNow);

  const [mode, setMode] = useState<PinModalMode>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [chosenLength, setChosenLength] = useState(4);
  const [step, setStep] = useState<"current" | "new" | "confirm">("new");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetModal() {
    setMode(null);
    setPin("");
    setPinConfirm("");
    setCurrentPin("");
    setChosenLength(4);
    setStep("new");
    setError(null);
    setBusy(false);
  }

  function openEnable() {
    setMode("enable");
    setStep("new");
    setPin("");
    setPinConfirm("");
    setError(null);
  }

  function openChange() {
    setMode("change");
    setStep("current");
    setCurrentPin("");
    setPin("");
    setPinConfirm("");
    setError(null);
  }

  function openDisable() {
    setMode("disable");
    setStep("current");
    setCurrentPin("");
    setError(null);
  }

  function openBio(enable: boolean) {
    setMode(enable ? "bio-enable" : "bio-disable");
    setStep("current");
    setCurrentPin("");
    setError(null);
  }

  async function finishEnable(confirmed: string) {
    if (!isValidPinFormat(confirmed)) {
      setError(`پین باید ${PIN_MIN_LENGTH} تا ${PIN_MAX_LENGTH} رقم باشد`);
      return;
    }
    if (pin !== confirmed) {
      setError("تکرار پین یکسان نیست");
      setPinConfirm("");
      return;
    }
    setBusy(true);
    try {
      await enableWithPin(confirmed);
      message.success("قفل اپ فعال شد");
      resetModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فعال‌سازی ناموفق بود");
      setBusy(false);
    }
  }

  async function finishChange(confirmed: string) {
    if (pin !== confirmed) {
      setError("تکرار پین یکسان نیست");
      setPinConfirm("");
      return;
    }
    setBusy(true);
    try {
      await changePin(currentPin, confirmed);
      message.success("پین تغییر کرد");
      resetModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تغییر پین ناموفق بود");
      setBusy(false);
      setStep("current");
      setCurrentPin("");
      setPin("");
      setPinConfirm("");
    }
  }

  async function finishDisable(pinValue: string) {
    setBusy(true);
    try {
      await disable(pinValue);
      message.success("قفل اپ خاموش شد");
      resetModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خاموش کردن ناموفق بود");
      setCurrentPin("");
      setBusy(false);
    }
  }

  async function finishBio(pinValue: string, enable: boolean) {
    if (!user?.id) {
      setError("ابتدا وارد حساب شوید");
      return;
    }
    setBusy(true);
    try {
      if (enable) {
        await enableBiometric(user.id, pinValue);
        message.success("بیومتریک فعال شد");
      } else {
        await disableBiometric(pinValue);
        message.success("بیومتریک خاموش شد");
      }
      resetModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "عملیات بیومتریک ناموفق بود");
      setCurrentPin("");
      setBusy(false);
    }
  }

  function onPadComplete(value: string) {
    if (mode === "enable") {
      if (step === "new") {
        if (value.length < PIN_MIN_LENGTH) {
          setError(`حداقل ${PIN_MIN_LENGTH} رقم`);
          setPin("");
          return;
        }
        setPin(value);
        setChosenLength(value.length);
        setStep("confirm");
        setPinConfirm("");
        setError(null);
        return;
      }
      void finishEnable(value);
      return;
    }

    if (mode === "change") {
      if (step === "current") {
        setCurrentPin(value);
        setStep("new");
        setPin("");
        setError(null);
        return;
      }
      if (step === "new") {
        if (value.length < PIN_MIN_LENGTH) {
          setError(`حداقل ${PIN_MIN_LENGTH} رقم`);
          setPin("");
          return;
        }
        setPin(value);
        setChosenLength(value.length);
        setStep("confirm");
        setPinConfirm("");
        setError(null);
        return;
      }
      void finishChange(value);
      return;
    }

    if (mode === "disable") {
      void finishDisable(value);
      return;
    }

    if (mode === "bio-enable") {
      void finishBio(value, true);
      return;
    }

    if (mode === "bio-disable") {
      void finishBio(value, false);
    }
  }

  const modalTitle =
    mode === "enable"
      ? "فعال‌سازی قفل اپ"
      : mode === "change"
        ? "تغییر پین"
        : mode === "disable"
          ? "خاموش کردن قفل"
          : mode === "bio-enable"
            ? "فعال‌سازی بیومتریک"
            : mode === "bio-disable"
              ? "خاموش کردن بیومتریک"
              : "";

  const modalHint =
    mode === "enable" && step === "new"
      ? `یک پین ${PIN_MIN_LENGTH} تا ${PIN_MAX_LENGTH} رقمی بسازید`
      : mode === "enable" && step === "confirm"
        ? "پین را دوباره وارد کنید"
        : mode === "change" && step === "current"
          ? "پین فعلی را وارد کنید"
          : mode === "change" && step === "new"
            ? "پین جدید را وارد کنید"
            : mode === "change" && step === "confirm"
              ? "پین جدید را تکرار کنید"
              : mode === "disable" || mode === "bio-enable" || mode === "bio-disable"
                ? "برای تأیید، پین فعلی را وارد کنید"
                : "";

  const padValue =
    mode === "enable" || mode === "change"
      ? step === "confirm"
        ? pinConfirm
        : step === "current"
          ? currentPin
          : pin
      : currentPin;

  const padMax =
    step === "confirm"
      ? chosenLength
      : step === "new" && (mode === "enable" || mode === "change")
        ? PIN_MAX_LENGTH
        : pinLength || 4;

  const showConfirmShortPin =
    (mode === "enable" || mode === "change") &&
    step === "new" &&
    padValue.length >= PIN_MIN_LENGTH &&
    padValue.length < PIN_MAX_LENGTH;

  return (
    <>
      <SectionCard
        title={
          <Space>
            <LockOutlined className="text-brand-500" />
            قفل اپ
          </Space>
        }
        description="با پین یا بیومتریک، بعد از باز شدن اپ یا برگشت از پس‌زمینه از اطلاعات مالی محافظت کنید — مخصوصاً روی PWA گوشی."
        extra={
          enabled ? <Tag color="success">فعال</Tag> : <Tag>خاموش</Tag>
        }
      >
        <Space orientation="vertical" size="middle" className="w-full">
          <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
            <div className="min-w-0">
              <Text strong className="!block">
                قفل با پین
              </Text>
              <Text type="secondary" className="!text-xs">
                روی این دستگاه ذخیره می‌شود
              </Text>
            </div>
            <Switch
              checked={enabled}
              onChange={(checked) => {
                if (checked) openEnable();
                else openDisable();
              }}
            />
          </Flex>

          {enabled ? (
            <>
              <div>
                <Text type="secondary" className="!text-xs !block mb-2">
                  قفل مجدد بعد از رفتن به پس‌زمینه
                </Text>
                <Select
                  className="w-full"
                  value={gracePeriodSec}
                  onChange={(v) => setGracePeriod(v)}
                  options={GRACE_PERIOD_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              </div>

              <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
                <div className="min-w-0">
                  <Text strong className="!block">
                    <ScanOutlined className="me-1" />
                    بیومتریک (Face ID / اثرانگشت)
                  </Text>
                  <Text type="secondary" className="!text-xs">
                    {biometricAvailable
                      ? "میان‌بر باز کردن؛ پین همیشه به‌عنوان پشتیبان می‌ماند"
                      : "روی این دستگاه/مرورگر در دسترس نیست"}
                  </Text>
                </div>
                <Switch
                  checked={biometricEnabled}
                  disabled={!biometricAvailable}
                  onChange={(checked) => openBio(checked)}
                />
              </Flex>

              <Flex gap="small" wrap="wrap">
                <Button icon={<SafetyCertificateOutlined />} onClick={openChange}>
                  تغییر پین
                </Button>
                <Button onClick={() => lockNow()}>قفل کردن الان</Button>
              </Flex>
            </>
          ) : null}
        </Space>
      </SectionCard>

      <Modal
        open={mode !== null}
        title={modalTitle}
        onCancel={resetModal}
        footer={null}
        centered
        destroyOnHidden
        maskClosable={!busy}
      >
        <Space orientation="vertical" size="middle" className="w-full items-center">
          <Text type="secondary" className="!text-sm !text-center !block">
            {modalHint}
          </Text>
          <PinPad
            value={padValue}
            onChange={(next) => {
              setError(null);
              if (mode === "enable" || mode === "change") {
                if (step === "confirm") setPinConfirm(next);
                else if (step === "current") setCurrentPin(next);
                else setPin(next);
              } else {
                setCurrentPin(next);
              }
            }}
            onComplete={(full) => onPadComplete(full)}
            disabled={busy}
            maxLength={padMax}
            error={error}
          />

          {showConfirmShortPin ? (
            <Button
              type="primary"
              className="!rounded-xl"
              loading={busy}
              onClick={() => onPadComplete(padValue)}
            >
              تأیید ({padValue.length} رقم)
            </Button>
          ) : null}

          {(mode === "enable" || mode === "change") && step === "new" ? (
            <Text type="secondary" className="!text-xs !text-center !block">
              ۴ تا ۶ رقم — برای پین کوتاه‌تر از ۶ رقم، دکمه تأیید را بزنید.
            </Text>
          ) : null}

          {/* Hidden field helps password managers ignore this as a login form */}
          <Input type="hidden" autoComplete="off" value="" readOnly tabIndex={-1} aria-hidden />
        </Space>
      </Modal>
    </>
  );
}
