"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Grid, Input, Space, Spin, Tag, Typography } from "antd";
import {
  BellOutlined,
  CameraOutlined,
  LoadingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { cn } from "@/lib/cn";
import {
  disablePushNotifications,
  enablePushNotifications,
  fetchPushStatus,
} from "@/lib/push";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      message.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error("حجم فایل بیشتر از ۵ مگابایت است");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setUploading(true);
    try {
      const res = await api.post("/api/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const nextUser = res.data?.data?.user;
      if (nextUser) setUser(nextUser);
      message.success("آواتار به‌روزرسانی شد");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در آپلود تصویر";
      message.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
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
    <Space orientation="vertical" size="large" className="w-full max-w-xl">
      <Title level={4} className="!m-0">
        تنظیمات پروفایل
      </Title>

      <Card>
        <Space orientation="vertical" size="large" className="w-full">
          <Flex align="center" gap="large" vertical={isMobile}>
            <Button
              type="text"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label="آپلود آواتار"
              className="group relative w-20 h-20 p-0 rounded-2xl overflow-hidden border border-slate-400/20 bg-gradient-to-br from-brand-500 to-brandViolet-500"
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {(user?.name ?? "پ").charAt(0)}
                </span>
              )}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity",
                  uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                )}
              >
                {uploading ? (
                  <Spin indicator={<LoadingOutlined className="text-[22px] text-white" />} />
                ) : (
                  <CameraOutlined className="text-[22px] text-white" />
                )}
              </div>
            </Button>

            <div className={cn("min-w-0", isMobile && "text-center")}>
              <Text strong>{user?.name ?? "—"}</Text>
              <div>
                <Text type="secondary" className="break-words">
                  {user?.email ?? ""}
                </Text>
              </div>
              <Text type="secondary" className="text-xs">
                JPEG / PNG / WebP — حداکثر ۵ مگابایت
              </Text>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={onAvatarChange}
            />
          </Flex>

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

      <Button icon={<LogoutOutlined />} onClick={onLogout}>
        خروج از حساب
      </Button>
    </Space>
  );
}
