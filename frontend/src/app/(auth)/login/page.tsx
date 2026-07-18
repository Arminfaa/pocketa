"use client";

import { Suspense, useState } from "react";
import { App, Button, Card, Flex, Form, Input, Space, Typography } from "antd";
import api from "@/services/api";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { useRouter, useSearchParams } from "next/navigation";
import { peekShareImportText } from "@/lib/share-import";

type LoginForm = {
  email: string;
  password: string;
};

function safeNextPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  if (raw.startsWith("/login") || raw.startsWith("/register")) return "/dashboard";
  return raw;
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionChecked = useAuthStore((s) => s.setSessionChecked);
  const [form] = Form.useForm<LoginForm>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: LoginForm) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/login", values);
      const payload = res.data?.data;
      const user = payload?.user as AuthUser | undefined;
      if (!user) throw new Error("User missing");

      setUser(user);
      setSessionChecked(true);
      message.success("ورود موفقیت‌آمیز بود");
      const next = safeNextPath(searchParams.get("next"));
      // Pending share (session) or share-target return URL → import page
      if (peekShareImportText() || next.includes("/imports/bank-sms")) {
        router.replace("/imports/bank-sms?from=share");
      } else {
        router.replace(next);
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const errorMessage = apiErr?.response?.data?.message ?? "خطای نامشخص";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Flex align="center" justify="center" className="min-h-dvh !p-6">
      <Card className="w-full max-w-md shadow-soft">
        <Space orientation="vertical" size="middle" className="w-full">
          <div className="text-center">
            <Typography.Title level={2} className="!mb-1 !mt-0">
              ورود به Pocketa
            </Typography.Title>
            <Typography.Text type="secondary">برای ادامه وارد حساب کاربری شوید.</Typography.Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            className="w-full"
          >
            <Form.Item
              label="ایمیل"
              name="email"
              rules={[
                { required: true, message: "ایمیل معتبر وارد کنید" },
                { type: "email", message: "ایمیل معتبر وارد کنید" },
              ]}
            >
              <Input type="email" dir="ltr" autoComplete="email" />
            </Form.Item>

            <Form.Item
              label="رمز عبور"
              name="password"
              rules={[{ required: true, message: "رمز عبور را وارد کنید" }]}
            >
              <Input.Password autoComplete="current-password" />
            </Form.Item>

            <Form.Item className="!mb-2">
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {submitting ? "در حال ورود..." : "ورود"}
              </Button>
            </Form.Item>

            <Typography.Text className="block text-center">
              حساب ندارید؟ <Typography.Link href="/register">ثبت‌نام</Typography.Link>
            </Typography.Text>
          </Form>
        </Space>
      </Card>
    </Flex>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Flex align="center" justify="center" className="min-h-dvh !p-6">
          <Card className="w-full max-w-md shadow-soft">
            <Typography.Text type="secondary">در حال بارگذاری…</Typography.Text>
          </Card>
        </Flex>
      }
    >
      <LoginFormInner />
    </Suspense>
  );
}
