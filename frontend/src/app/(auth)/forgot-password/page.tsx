"use client";

import { useState } from "react";
import { App, Button, Card, Flex, Form, Input, Space, Typography } from "antd";
import api from "@/services/api";

type ForgotForm = {
  email: string;
};

export default function ForgotPasswordPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<ForgotForm>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish(values: ForgotForm) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/forgot-password", { email: values.email });
      setSent(true);
      message.success(res.data?.message ?? "اگر ایمیل ثبت شده باشد، لینک بازیابی ارسال می‌شود");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message ?? "خطای نامشخص");
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
              فراموشی رمز عبور
            </Typography.Title>
            <Typography.Text type="secondary">
              ایمیل حساب را وارد کنید تا لینک بازیابی برایتان ارسال شود.
            </Typography.Text>
          </div>

          {sent ? (
            <Space orientation="vertical" size="middle" className="w-full">
              <Typography.Paragraph className="!mb-0 text-center">
                اگر این ایمیل در سیستم ثبت شده باشد، لینک بازیابی ارسال شده است. Inbox و پوشه Spam را
                بررسی کنید.
              </Typography.Paragraph>
              <Button type="primary" block href="/login">
                بازگشت به ورود
              </Button>
            </Space>
          ) : (
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

              <Form.Item className="!mb-2">
                <Button type="primary" htmlType="submit" block loading={submitting}>
                  {submitting ? "در حال ارسال..." : "ارسال لینک بازیابی"}
                </Button>
              </Form.Item>

              <Typography.Text className="block text-center">
                <Typography.Link href="/login">بازگشت به ورود</Typography.Link>
              </Typography.Text>
            </Form>
          )}
        </Space>
      </Card>
    </Flex>
  );
}
