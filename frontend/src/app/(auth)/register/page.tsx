"use client";

import { useState } from "react";
import { App, Button, Card, Flex, Form, Input, Space, Typography } from "antd";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const setUser = useAuthStore((s) => s.setUser);
  const setSessionChecked = useAuthStore((s) => s.setSessionChecked);
  const [form] = Form.useForm<RegisterForm>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: RegisterForm) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/register", {
        name: values.name,
        email: values.email,
        password: values.password,
      });
      message.success(res.data?.message ?? "ثبت‌نام انجام شد");

      const loginRes = await api.post("/api/auth/login", {
        email: values.email,
        password: values.password,
      });
      const loginPayload = loginRes.data?.data;
      setUser(loginPayload?.user ?? null);
      setSessionChecked(true);
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
    <Flex align="center" justify="center" className="min-h-dvh !p-6">
      <Card className="w-full max-w-md shadow-soft">
        <Space orientation="vertical" size="middle" className="w-full">
          <div className="text-center">
            <Typography.Title level={2} className="!mb-1 !mt-0">
              ثبت‌نام در Pocketa
            </Typography.Title>
            <Typography.Text type="secondary">
              ثبت‌نام شما تنها چند ثانیه زمان می‌برد.
            </Typography.Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={onFinish}
            initialValues={{ name: "", email: "", password: "", confirmPassword: "" }}
            className="w-full"
          >
            <Form.Item
              label="نام"
              name="name"
              rules={[
                { required: true, message: "نام را وارد کنید" },
                { min: 2, message: "نام را وارد کنید" },
              ]}
            >
              <Input dir="rtl" autoComplete="name" />
            </Form.Item>

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
              rules={[
                { required: true, message: "حداقل ۸ کاراکتر" },
                { min: 8, message: "حداقل ۸ کاراکتر" },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>

            <Form.Item
              label="تکرار رمز عبور"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "تکرار رمز عبور را وارد کنید" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("رمز عبور و تکرار آن یکسان نیستند"));
                  },
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>

            <Form.Item className="!mb-2">
              <Button type="primary" htmlType="submit" block loading={submitting}>
                {submitting ? "در حال ثبت‌نام..." : "ثبت‌نام"}
              </Button>
            </Form.Item>

            <Typography.Text className="block text-center">
              حساب دارید؟ <Typography.Link href="/login">ورود</Typography.Link>
            </Typography.Text>
          </Form>
        </Space>
      </Card>
    </Flex>
  );
}
