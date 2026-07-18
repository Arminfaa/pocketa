"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { App, Button, Flex, Input, Space, Tag, Typography } from "antd";
import {
  BellOutlined,
  KeyOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { SettingsSkeleton } from "@/components/skeletons";
import { Sk } from "@/components/ui/skeleton";
import { SectionCard } from "@/components/ui/section-card";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import {
  disablePushNotifications,
  enablePushNotifications,
  fetchPushStatus,
} from "@/lib/push";

const { Text } = Typography;

export default function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const pushStatusQ = useQuery({ queryKey: ["push-status"], queryFn: fetchPushStatus });

  const pushEnableMutation = useMutation({
    mutationFn: enablePushNotifications,
    onSuccess: () => {
      message.success("یادآوری پوش روی این دستگاه فعال شد");
      void queryClient.invalidateQueries({ queryKey: ["push-status"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "فعال‌سازی پوش ناموفق بود");
    },
  });

  const pushDisableMutation = useMutation({
    mutationFn: disablePushNotifications,
    onSuccess: () => {
      message.success("پوش این دستگاه خاموش شد");
      void queryClient.invalidateQueries({ queryKey: ["push-status"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "خاموش کردن پوش ناموفق بود");
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (currentPassword.length < 1) throw new Error("رمز فعلی را وارد کنید");
      if (newPassword.length < 8) throw new Error("رمز جدید باید حداقل ۸ کاراکتر باشد");
      if (newPassword !== confirmPassword) throw new Error("تکرار رمز جدید یکسان نیست");
      if (newPassword === currentPassword) {
        throw new Error("رمز جدید باید با رمز فعلی فرق داشته باشد");
      }
      await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
    },
    onSuccess: () => {
      message.success("رمز عبور تغییر کرد");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در تغییر رمز");
      message.error(msg);
    },
  });

  async function onLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    } finally {
      logout();
      message.success("خارج شدید");
      router.replace("/login");
    }
  }

  async function onSaveProfile() {
    if (!name.trim() || name.trim().length < 2) {
      message.error("نام باید حداقل ۲ کاراکتر باشد");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/api/profile", { name: name.trim() });
      const nextUser = res.data?.data?.user;
      if (nextUser) setUser(nextUser);
      message.success("پروفایل ذخیره شد");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره پروفایل";
      message.error(msg);
    } finally {
      setSaving(false);
    }
  }

  const pushConfigured = pushStatusQ.data?.configured !== false;
  const pushSupported = pushStatusQ.data?.supported !== false;
  const pushActive = Boolean(pushStatusQ.data?.thisDevice);

  return (
    <PageShell width="narrow">
      <PageHeader
        icon={<SettingOutlined />}
        title="تنظیمات پروفایل"
        description="نام نمایشی، تغییر رمز، یادآوری پوش و خروج از حساب."
      />

      {!user ? (
        <SettingsSkeleton />
      ) : (
        <>
          <SectionCard title="پروفایل" description={user.email ?? undefined}>
            <Space orientation="vertical" size="large" className="w-full">
              <div>
                <Text strong>{user.name ?? "—"}</Text>
                <div>
                  <Text type="secondary" className="break-words">
                    {user.email ?? ""}
                  </Text>
                </div>
              </div>

              <div>
                <Text type="secondary">نام نمایشی</Text>
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <Button type="primary" loading={saving} onClick={onSaveProfile}>
                {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </Button>
            </Space>
          </SectionCard>

          <SectionCard
            title={
              <Space>
                <KeyOutlined className="text-brand-500" />
                تغییر رمز عبور
              </Space>
            }
            description="رمز فعلی را وارد کنید و رمز جدید بگذارید (حداقل ۸ کاراکتر)."
          >
            <Space orientation="vertical" size="middle" className="w-full">
              <div>
                <Text type="secondary">رمز فعلی</Text>
                <Input.Password
                  className="mt-2"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Text type="secondary">رمز جدید</Text>
                <Input.Password
                  className="mt-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Text type="secondary">تکرار رمز جدید</Text>
                <Input.Password
                  className="mt-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="primary"
                loading={changePasswordMutation.isPending}
                onClick={() => changePasswordMutation.mutate()}
              >
                تغییر رمز
              </Button>
            </Space>
          </SectionCard>

          {pushStatusQ.isLoading ? (
            <SectionCard
              title={
                <Space>
                  <BellOutlined className="text-brand-500" />
                  یادآوری پوش
                </Space>
              }
            >
              <div className="space-y-3" aria-busy="true">
                <Sk className="h-3 w-full" />
                <Sk className="h-3 w-2/3" />
                <div className="flex flex-wrap gap-2">
                  <Sk className="h-6 w-28 rounded-full" />
                  <Sk className="h-9 w-40 rounded-lg" />
                </div>
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title={
                <Space>
                  <BellOutlined className="text-brand-500" />
                  یادآوری پوش
                </Space>
              }
              description="یادآوری بدهی/قسط از ۳ روز قبل موعد. روی هر دستگاه جداگانه فعال می‌شود."
            >
              <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
                <div className="min-w-0">
                  <div>
                    {pushActive ? (
                      <Tag color="success">فعال روی این دستگاه</Tag>
                    ) : (
                      <Tag>غیرفعال روی این دستگاه</Tag>
                    )}
                  </div>
                </div>
                {pushActive ? (
                  <Button
                    size="small"
                    className="!rounded-xl"
                    loading={pushDisableMutation.isPending}
                    onClick={() => pushDisableMutation.mutate()}
                  >
                    خاموش کردن
                  </Button>
                ) : (
                  <Button
                    size="small"
                    className="!rounded-xl"
                    icon={<BellOutlined />}
                    loading={pushEnableMutation.isPending}
                    onClick={() => pushEnableMutation.mutate()}
                    disabled={!pushConfigured || !pushSupported}
                  >
                    فعال‌سازی روی این دستگاه
                  </Button>
                )}
              </Flex>
            </SectionCard>
          )}

          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            خروج از حساب
          </Button>
        </>
      )}
    </PageShell>
  );
}
