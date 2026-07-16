"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Col,
  Flex,
  Grid,
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
import { contributeGoal, createGoal, deleteGoal, fetchGoals } from "@/services/goals";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";
import { CATEGORY_COLORS } from "@/lib/finance-ui";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

export default function GoalsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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
      const target = parseAmountInput(targetAmount);
      const current = parseAmountInput(currentAmount);
      const currentSafe = Number.isFinite(current) && current > 0 ? current : 0;
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(target) || target <= 0) throw new Error("مبلغ هدف معتبر نیست");
      return createGoal({
        title: title.trim(),
        targetAmount: target,
        currentAmount: currentSafe,
        deadline: deadline ? normalizeJalaliDateInput(deadline) : undefined,
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
          : ((err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            "خطا در ذخیره هدف");
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
    <Space orientation="vertical" size="large" className="w-full max-w-3xl">
      <div>
        <Title level={4} className="!m-0">
          <Space>
            <AimOutlined />
            اهداف پس‌انداز
          </Space>
        </Title>
        <Text type="secondary">برای سفر، خرید یا اضطراری هدف بگذارید و پیشرفت را دنبال کنید.</Text>
      </div>

      {summary ? (
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="کل اهداف" value={formatToman(summary.totalTarget)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic
                title="پس‌انداز شده"
                value={formatToman(summary.totalSaved)}
                className="[&_.ant-statistic-content-value]:text-brand-500"
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
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
        <Space orientation="vertical" size="middle" className="w-full">
          <Input
            placeholder="مثلاً سفر شمال"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12} md={8}>
              <AmountInput
                placeholder="مبلغ هدف (تومان)"
                value={targetAmount}
                onChange={setTargetAmount}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <AmountInput
                placeholder="پس‌انداز فعلی"
                value={currentAmount}
                onChange={setCurrentAmount}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <JalaliDateInput
                placeholder="مهلت YYYY/MM/DD"
                value={deadline}
                onChange={setDeadline}
              />
            </Col>
            <Col xs={24}>
              <Flex gap={8} wrap="wrap" align="center">
                {CATEGORY_COLORS.slice(0, 6).map((c) => (
                  <Button
                    key={c}
                    type="text"
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "w-8 h-8 min-w-8 p-0 rounded-xl",
                      color === c
                        ? "border-2 border-white ring-2 ring-brand-500"
                        : "border border-slate-400/20"
                    )}
                    style={{ background: c }}
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

      <Space orientation="vertical" size="middle" className="w-full">
        {items.map((goal) => (
          <Card key={goal.id} className={cn(goal.completed && "border-emerald-400/40")}>
            <Flex justify="space-between" align="flex-start" gap="middle" wrap="wrap">
              <Flex align="center" gap="middle" className="min-w-0 flex-1 mb-3">
                <div className="w-10 h-10 rounded-xl shrink-0" style={{ background: goal.color }} />
                <div className="min-w-0">
                  <Text strong ellipsis>
                    {goal.title}
                    {goal.completed ? (
                      <Tag color="green" className="!ms-2">
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
                <Button type="default" danger icon={<DeleteOutlined />} aria-label="حذف" />
              </Popconfirm>
            </Flex>

            <Progress
              percent={goal.percent}
              showInfo={false}
              strokeColor={goal.color}
              className="mt-3"
            />
            <Text type="secondary" className="text-xs">
              {goal.percent.toFixed(0)}% · باقیمانده {formatToman(goal.remaining)}
            </Text>

            {!goal.completed ? (
              <Flex
                gap="small"
                wrap="wrap"
                vertical={isMobile}
                className={cn("mt-3", isMobile && "w-full")}
              >
                <div className={cn("flex-1", isMobile ? "min-w-full" : "min-w-[120px]")}>
                  <AmountInput
                    placeholder="مبلغ افزودنی"
                    value={contributeAmounts[goal.id] ?? ""}
                    onChange={(v) =>
                      setContributeAmounts((s) => ({ ...s, [goal.id]: v }))
                    }
                  />
                </div>
                <Button
                  type="primary"
                  block={isMobile}
                  loading={contributeMutation.isPending}
                  onClick={() => {
                    const value = parseAmountInput(contributeAmounts[goal.id] ?? "");
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
