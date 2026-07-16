"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Input,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { AimOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  contributeGoal,
  createGoal,
  deleteGoal,
  fetchGoals,
} from "@/services/goals";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";

const { Title, Text } = Typography;

export default function GoalsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]!);
  const [contributeAmounts, setContributeAmounts] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });

  const createMutation = useMutation({
    mutationFn: async () => {
      const target = Number(targetAmount.replace(/,/g, ""));
      const current = Number(currentAmount.replace(/,/g, "")) || 0;
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(target) || target <= 0) throw new Error("مبلغ هدف معتبر نیست");
      return createGoal({
        title: title.trim(),
        targetAmount: target,
        currentAmount: current,
        deadline: deadline || undefined,
        color,
      });
    },
    onSuccess: () => {
      message.success("هدف پس‌انداز ساخته شد");
      setTitle("");
      setTargetAmount("");
      setCurrentAmount("0");
      setDeadline("");
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره هدف";
      message.error(msg);
    },
  });

  const contributeMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) =>
      contributeGoal(id, amount),
    onSuccess: (_data, vars) => {
      message.success("به هدف اضافه شد");
      setContributeAmounts((s) => ({ ...s, [vars.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در افزودن مبلغ";
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => {
      message.success("هدف حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const items = q.data?.items ?? [];
  const summary = q.data?.summary;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 768 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          <Space>
            <AimOutlined />
            اهداف پس‌انداز
          </Space>
        </Title>
        <Text type="secondary">
          برای سفر، خرید یا اضطراری هدف بگذارید و پیشرفت را دنبال کنید.
        </Text>
      </div>

      {summary ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="کل اهداف" value={formatToman(summary.totalTarget)} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="پس‌انداز شده"
                value={formatToman(summary.totalSaved)}
                valueStyle={{ color: "#06b6d4" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic title="تکمیل‌شده" value={summary.completedCount} />
            </Card>
          </Col>
        </Row>
      ) : null}

      <Card
        title={
          <Space>
            <PlusOutlined />
            هدف جدید
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Input
            placeholder="مثلاً سفر شمال"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Input
                dir="ltr"
                placeholder="مبلغ هدف (تومان)"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                dir="ltr"
                placeholder="پس‌انداز فعلی"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                dir="ltr"
                placeholder="مهلت اختیاری YYYY/MM/DD"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Flex gap={8} wrap="wrap" align="center">
                {CATEGORY_COLORS.slice(0, 6).map((c) => (
                  <Button
                    key={c}
                    type="text"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 32,
                      height: 32,
                      minWidth: 32,
                      padding: 0,
                      borderRadius: 12,
                      background: c,
                      border:
                        color === c ? "2px solid #fff" : "1px solid rgba(148, 163, 184, 0.22)",
                      boxShadow: color === c ? "0 0 0 2px #06b6d4" : undefined,
                    }}
                  />
                ))}
              </Flex>
            </Col>
          </Row>
          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "در حال ذخیره..." : "ایجاد هدف"}
          </Button>
        </Space>
      </Card>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {q.error ? (
        <QueryError message="خطا در دریافت اهداف." onRetry={() => void q.refetch()} />
      ) : null}

      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {items.map((goal) => (
          <Card
            key={goal.id}
            style={{
              borderColor: goal.completed ? "rgba(52, 211, 153, 0.4)" : undefined,
            }}
          >
            <Flex justify="space-between" align="flex-start" gap="middle">
              <Flex align="center" gap="middle" style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: goal.color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <Text strong ellipsis>
                    {goal.title}
                    {goal.completed ? (
                      <Tag color="green" style={{ marginInlineStart: 8 }}>
                        تکمیل
                      </Tag>
                    ) : null}
                  </Text>
                  <div>
                    <Text type="secondary">
                      {formatToman(goal.currentAmount)} از {formatToman(goal.targetAmount)}
                      {goal.deadline ? ` · مهلت ${formatJalaliDate(goal.deadline)}` : ""}
                    </Text>
                  </div>
                </div>
              </Flex>
              <Popconfirm
                title="حذف هدف"
                description="این هدف حذف شود؟"
                okText="حذف"
                cancelText="انصراف"
                okButtonProps={{ danger: true }}
                onConfirm={() => deleteMutation.mutate(goal.id)}
              >
                <Button
                  type="default"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="حذف"
                />
              </Popconfirm>
            </Flex>

            <Progress
              percent={goal.percent}
              showInfo={false}
              strokeColor={goal.color}
              style={{ marginTop: 12 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {goal.percent.toFixed(0)}% · باقیمانده {formatToman(goal.remaining)}
            </Text>

            {!goal.completed ? (
              <Flex gap="small" style={{ marginTop: 12 }}>
                <Input
                  dir="ltr"
                  placeholder="مبلغ افزودنی"
                  value={contributeAmounts[goal.id] ?? ""}
                  onChange={(e) =>
                    setContributeAmounts((s) => ({ ...s, [goal.id]: e.target.value }))
                  }
                />
                <Button
                  type="primary"
                  loading={contributeMutation.isPending}
                  onClick={() => {
                    const value = Number((contributeAmounts[goal.id] ?? "").replace(/,/g, ""));
                    if (!Number.isFinite(value) || value <= 0) {
                      message.error("مبلغ معتبر نیست");
                      return;
                    }
                    contributeMutation.mutate({ id: goal.id, amount: value });
                  }}
                >
                  افزودن
                </Button>
              </Flex>
            ) : null}
          </Card>
        ))}
      </Space>

      {!q.isLoading && items.length === 0 ? (
        <EmptyState
          title="هنوز هدفی تعریف نشده"
          description="برای سفر، خرید یا اضطراری یک هدف پس‌انداز بسازید."
        />
      ) : null}
    </Space>
  );
}
