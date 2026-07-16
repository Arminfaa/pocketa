"use client";

import { useState } from "react";
import { App, Button, Card, Flex, Form, Input, Space, Typography } from "antd";
import api from "@/services/api";
import { useAuthStore, type AuthUser } from "@/stores/auth.store";
import { useRouter } from "next/navigation";

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const [form] = Form.useForm<LoginForm>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: LoginForm) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/login", values);
      const payload = res.data?.data;
      const accessToken = payload?.accessToken as string | undefined;
      const user = payload?.user as AuthUser | undefined;
      if (!accessToken) throw new Error("Access token missing");

      setAccessToken(accessToken);
      setUser(user ?? null);
      message.success("ورود موفقیت‌آمیز بود");
      router.replace("/dashboard");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const errorMessage = apiErr?.response?.data?.message ?? "خطای نامشخص";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Flex align="center" justify="center" className="min-h-screen p-6">
      <Card className="w-full max-w-md shadow-soft">
        <Space direction="vertical" size="middle" className="w-full">
          <div className="text-center">
            <Typography.Title level={2} className="!mb-1 !mt-0">
              ورود به Pocketa
            </Typography.Title>
            <Typography.Text type="secondary">
              برای ادامه وارد حساب کاربری شوید.
            </Typography.Text>
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
