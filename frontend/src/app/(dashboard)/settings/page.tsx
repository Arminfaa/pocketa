"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { App, Button, Card, Flex, Grid, Input, Space, Spin, Typography } from "antd";
import { CameraOutlined, LoadingOutlined, LogoutOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

export default function SettingsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

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

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 576 }}>
      <Title level={4} style={{ margin: 0 }}>
        تنظیمات پروفایل
      </Title>

      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Flex align="center" gap="large" vertical={isMobile}>
            <Button
              type="text"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              aria-label="آپلود آواتار"
              style={{
                position: "relative",
                width: 80,
                height: 80,
                padding: 0,
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
              }}
            >
              {user?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
                  {(user?.name ?? "پ").charAt(0)}
                </span>
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.45)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: uploading ? 1 : 0,
                  transition: "opacity 0.2s",
                }}
                className="avatar-overlay"
              >
                {uploading ? (
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 22, color: "#fff" }} />} />
                ) : (
                  <CameraOutlined style={{ fontSize: 22, color: "#fff" }} />
                )}
              </div>
            </Button>

            <div style={{ minWidth: 0, textAlign: isMobile ? "center" : undefined }}>
              <Text strong>{user?.name ?? "—"}</Text>
              <div>
                <Text type="secondary" style={{ wordBreak: "break-word" }}>
                  {user?.email ?? ""}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                JPEG / PNG / WebP — حداکثر ۵ مگابایت
              </Text>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={onAvatarChange}
            />
          </Flex>

          <div>
            <Text type="secondary">نام نمایشی</Text>
            <Input
              style={{ marginTop: 8 }}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <Button type="primary" loading={saving} onClick={onSaveProfile}>
            {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
          </Button>
        </Space>
      </Card>

      <Button icon={<LogoutOutlined />} onClick={onLogout}>
        خروج از حساب
      </Button>

      <style jsx global>{`
        button[aria-label="آپلود آواتار"]:hover .avatar-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </Space>
  );
}
