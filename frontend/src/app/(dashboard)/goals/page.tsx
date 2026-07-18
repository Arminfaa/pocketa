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
  Select,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import { AimOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { contributeGoal, createGoal, deleteGoal, fetchGoals } from "@/services/goals";
import { fetchAccounts } from "@/services/accounts";
import { formatJalaliDate, formatToman } from "@/lib/format";
import { normalizeJalaliDateInput, parseAmountInput } from "@/lib/amount";
import { CATEGORY_COLORS } from "@/lib/finance-ui";
import { AmountInput } from "@/components/ui/amount-input";
import { JalaliDateInput } from "@/components/ui/jalali-date-input";
import { GoalsListSkeleton, KpiRowSkeleton } from "@/components/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { useAccountFilterStore } from "@/stores/account-filter.store";
import { cn } from "@/lib/cn";

const { Title, Text } = Typography;

export default function GoalsPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]!);
  const [contributeAmounts, setContributeAmounts] = useState<Record<string, string>>({});
  const [contributeAccounts, setContributeAccounts] = useState<Record<string, string>>({});
  const selectedAccountId = useAccountFilterStore((s) => s.selectedAccountId);

  const q = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
  const accountsQ = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });

  const createMutation = useMutation({
    mutationFn: async () => {
      const target = parseAmountInput(targetAmount);
      if (title.trim().length < 2) throw new Error("عنوان را وارد کنید");
      if (!Number.isFinite(target) || target <= 0) throw new Error("مبلغ هدف معتبر نیست");
      return createGoal({
        title: title.trim(),
        targetAmount: target,
        currentAmount: 0,
        deadline: deadline ? normalizeJalaliDateInput(deadline) : undefined,
        color,
      });
    },
    onSuccess: () => {
      message.success("هدف پس‌انداز ساخته شد");
      setTitle("");
      setTargetAmount("");
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
    mutationFn: async ({
      id,
      amount,
      accountId,
    }: {
      id: string;
      amount: number;
      accountId: string;
    }) => contributeGoal(id, { amount, accountId }),
    onSuccess: (_data, vars) => {
      message.success("از حساب کم و به هدف اضافه شد");
      setContributeAmounts((s) => ({ ...s, [vars.id]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

      {q.isLoading ? (
        <KpiRowSkeleton count={3} colProps={{ xs: 24, md: 8 }} />
      ) : summary ? (
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
          <Text type="secondary" className="text-xs">
            پیشرفت هدف فقط با «افزودن» از حساب بانکی ثبت می‌شود تا موجودی نقد دوبار شمرده نشود.
          </Text>
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <AmountInput
                placeholder="مبلغ هدف (تومان)"
                value={targetAmount}
                onChange={setTargetAmount}
              />
            </Col>
            <Col xs={24} sm={12}>
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

      {q.isLoading ? <GoalsListSkeleton /> : null}
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
                <Select
                  className={cn(isMobile ? "w-full" : "min-w-[160px]")}
                  placeholder="از حساب"
                  value={
                    contributeAccounts[goal.id] ||
                    selectedAccountId ||
                    accountsQ.data?.[0]?.id
                  }
                  onChange={(v) =>
                    setContributeAccounts((s) => ({ ...s, [goal.id]: v }))
                  }
                  options={(accountsQ.data ?? []).map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                />
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
                    const accountId =
                      contributeAccounts[goal.id] ||
                      selectedAccountId ||
                      accountsQ.data?.[0]?.id ||
                      "";
                    if (!Number.isFinite(value) || value <= 0) {
                      message.error("مبلغ معتبر نیست");
                      return;
                    }
                    if (!accountId) {
                      message.error("حساب بانکی را انتخاب کنید");
                      return;
                    }
                    contributeMutation.mutate({ id: goal.id, amount: value, accountId });
                  }}
                >
                  افزودن از حساب
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
