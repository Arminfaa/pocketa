"use client";

import { Suspense, useState } from "react";
import { App, Button, Card, Flex, Form, Input, Space, Typography } from "antd";
import api from "@/services/api";
import { useRouter, useSearchParams } from "next/navigation";

type ResetForm = {
  newPassword: string;
  confirmPassword: string;
};

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { message } = App.useApp();
  const [form] = Form.useForm<ResetForm>();
  const [submitting, setSubmitting] = useState(false);

  async function onFinish(values: ResetForm) {
    if (!token) {
      message.error("لینک بازیابی نامعتبر است");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/api/auth/reset-password", {
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      message.success(res.data?.message ?? "رمز عبور تغییر کرد");
      router.replace("/login");
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      message.error(apiErr?.response?.data?.message ?? "خطای نامشخص");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Space orientation="vertical" size="middle" className="w-full">
        <Typography.Paragraph className="!mb-0 text-center" type="danger">
          لینک بازیابی نامعتبر است. دوباره از صفحه فراموشی رمز درخواست کنید.
        </Typography.Paragraph>
        <Button type="primary" block href="/forgot-password">
          درخواست لینک جدید
        </Button>
      </Space>
    );
  }

  return (
    <Form form={form} layout="vertical" requiredMark={false} onFinish={onFinish} className="w-full">
      <Form.Item
        label="رمز عبور جدید"
        name="newPassword"
        rules={[
          { required: true, message: "رمز عبور را وارد کنید" },
          { min: 8, message: "رمز عبور حداقل ۸ کاراکتر باشد" },
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      <Form.Item
        label="تکرار رمز عبور جدید"
        name="confirmPassword"
        dependencies={["newPassword"]}
        rules={[
          { required: true, message: "تکرار رمز را وارد کنید" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
              return Promise.reject(new Error("تکرار رمز یکسان نیست"));
            },
          }),
        ]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>

      <Form.Item className="!mb-2">
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {submitting ? "در حال ذخیره..." : "ذخیره رمز جدید"}
        </Button>
      </Form.Item>

      <Typography.Text className="block text-center">
        <Typography.Link href="/login">بازگشت به ورود</Typography.Link>
      </Typography.Text>
    </Form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Flex align="center" justify="center" className="min-h-dvh !p-6">
      <Card className="w-full max-w-md shadow-soft">
        <Space orientation="vertical" size="middle" className="w-full">
          <div className="text-center">
            <Typography.Title level={2} className="!mb-1 !mt-0">
              تعیین رمز جدید
            </Typography.Title>
            <Typography.Text type="secondary">رمز عبور جدید حساب را وارد کنید.</Typography.Text>
          </div>

          <Suspense
            fallback={
              <Typography.Text type="secondary" className="block text-center">
                در حال بارگذاری...
              </Typography.Text>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </Space>
      </Card>
    </Flex>
  );
}
