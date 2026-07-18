"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Input, Space, Tag, Typography } from "antd";
import { BellOutlined, LogoutOutlined, SettingOutlined } from "@ant-design/icons";
import { SettingsSkeleton } from "@/components/skeletons";
import { Sk } from "@/components/ui/skeleton";
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
        description="نام نمایشی، یادآوری پوش و خروج از حساب."
      />

      {!user ? (
        <SettingsSkeleton />
      ) : (
        <>
          <Card>
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
          </Card>

          {pushStatusQ.isLoading ? (
            <Card
              title={
                <Space>
                  <BellOutlined />
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
            </Card>
          ) : (
            <Card
              title={
                <Space>
                  <BellOutlined />
                  یادآوری پوش
                </Space>
              }
            >
              <Flex justify="space-between" align="center" gap="middle" wrap="wrap">
                <div className="min-w-0">
                  <Text type="secondary" className="text-xs">
                    یادآوری بدهی/قسط از ۳ روز قبل موعد. روی هر دستگاه جداگانه فعال می‌شود.
                  </Text>
                  <div className="mt-2">
                    {pushActive ? (
                      <Tag color="success">فعال روی این دستگاه</Tag>
                    ) : (
                      <Tag>غیرفعال روی این دستگاه</Tag>
                    )}
                  </div>
                </div>
                {pushActive ? (
                  <Button
                    loading={pushDisableMutation.isPending}
                    onClick={() => pushDisableMutation.mutate()}
                  >
                    خاموش کردن
                  </Button>
                ) : (
                  <Button
                    icon={<BellOutlined />}
                    loading={pushEnableMutation.isPending}
                    onClick={() => pushEnableMutation.mutate()}
                    disabled={!pushConfigured || !pushSupported}
                  >
                    فعال‌سازی روی این دستگاه
                  </Button>
                )}
              </Flex>
            </Card>
          )}

          <Button icon={<LogoutOutlined />} onClick={onLogout}>
            خروج از حساب
          </Button>
        </>
      )}
    </PageShell>
  );
}
