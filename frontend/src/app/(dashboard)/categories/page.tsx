"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Flex,
  Input,
  List,
  Popconfirm,
  Radio,
  Space,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from "@/services/categories";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/finance-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";

const { Title, Text } = Typography;

type FormState = {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
};

const emptyForm: FormState = {
  name: "",
  type: "expense",
  icon: "Utensils",
  color: CATEGORY_COLORS[0]!,
};

export default function CategoriesPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const q = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        icon: form.icon,
        color: form.color,
      };
      if (editingId) return updateCategory(editingId, payload);
      return createCategory(payload);
    },
    onSuccess: () => {
      message.success(editingId ? "دسته به‌روزرسانی شد" : "دسته جدید ساخته شد");
      setForm(emptyForm);
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره دسته";
      message.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      message.success("دسته حذف شد");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در حذف دسته";
      message.error(msg);
    },
  });

  const items = useMemo(() => {
    const all = q.data ?? [];
    if (filter === "all") return all;
    return all.filter((c) => c.type === filter);
  }, [q.data, filter]);

  function startEdit(c: Category) {
    setEditingId(c._id);
    setForm({
      name: c.name,
      type: c.type,
      icon: c.icon || "Utensils",
      color: c.color || CATEGORY_COLORS[0]!,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", maxWidth: 768 }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          دسته‌بندی‌ها
        </Title>
        <Text type="secondary">دسته‌های درآمد و هزینه را با رنگ و آیکون مدیریت کنید.</Text>
      </div>

      <Card
        title={
          <Space>
            <PlusOutlined />
            {editingId ? "ویرایش دسته" : "افزودن دسته جدید"}
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <div>
            <Text type="secondary">نام</Text>
            <Input
              style={{ marginTop: 8 }}
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder="مثلاً خوراک"
            />
          </div>

          <div>
            <Text type="secondary">نوع</Text>
            <Radio.Group
              style={{ marginTop: 8, width: "100%" }}
              value={form.type}
              onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
              optionType="button"
              buttonStyle="solid"
              block
            >
              <Radio.Button value="expense">هزینه</Radio.Button>
              <Radio.Button value="income">درآمد</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <Text type="secondary">رنگ</Text>
            <Flex gap={8} wrap="wrap" style={{ marginTop: 8 }}>
              {CATEGORY_COLORS.map((c) => (
                <Button
                  key={c}
                  type="text"
                  aria-label={c}
                  onClick={() => setForm((s) => ({ ...s, color: c }))}
                  style={{
                    width: 32,
                    height: 32,
                    minWidth: 32,
                    padding: 0,
                    borderRadius: 12,
                    background: c,
                    border:
                      form.color === c ? "2px solid #fff" : "1px solid rgba(148, 163, 184, 0.22)",
                    boxShadow: form.color === c ? "0 0 0 2px #06b6d4" : undefined,
                  }}
                />
              ))}
            </Flex>
          </div>

          <div>
            <Text type="secondary">آیکون</Text>
            <Flex gap={8} wrap="wrap" style={{ marginTop: 8 }}>
              {CATEGORY_ICONS.map((icon) => (
                <Button
                  key={icon}
                  size="small"
                  type={form.icon === icon ? "primary" : "default"}
                  onClick={() => setForm((s) => ({ ...s, icon }))}
                >
                  {icon}
                </Button>
              ))}
            </Flex>
          </div>

          <Space>
            <Button
              type="primary"
              loading={saveMutation.isPending}
              disabled={form.name.trim().length < 2}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "در حال ذخیره..." : editingId ? "ذخیره تغییرات" : "افزودن"}
            </Button>
            {editingId ? <Button onClick={cancelEdit}>انصراف</Button> : null}
          </Space>
        </Space>
      </Card>

      <Radio.Group
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        optionType="button"
        buttonStyle="solid"
      >
        <Radio.Button value="all">همه</Radio.Button>
        <Radio.Button value="expense">هزینه</Radio.Button>
        <Radio.Button value="income">درآمد</Radio.Button>
      </Radio.Group>

      {q.isLoading ? <Skeleton className="h-40 w-full" /> : null}
      {q.error ? (
        <QueryError message="خطا در دریافت دسته‌بندی‌ها." onRetry={() => void q.refetch()} />
      ) : null}

      {!q.isLoading && !q.error && items.length === 0 ? (
        <EmptyState
          title="دسته‌ای یافت نشد"
          description="یک دسته‌بندی جدید بسازید یا فیلتر نوع را تغییر دهید."
        />
      ) : null}

      <List
        grid={{ gutter: 12, xs: 1, md: 2 }}
        dataSource={items}
        renderItem={(c) => (
          <List.Item>
            <Card style={{ width: "100%" }} styles={{ body: { padding: 16 } }}>
              <Flex justify="space-between" align="center" gap="middle">
                <Flex align="center" gap="middle" style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: c.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                    title={c.icon}
                  >
                    {c.icon?.slice(0, 2) ?? "?"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text strong ellipsis>
                      {c.name}
                    </Text>
                    <div>
                      <Tag color={c.type === "income" ? "green" : "red"}>
                        {c.type === "income" ? "درآمد" : "هزینه"}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {c.icon}
                      </Text>
                    </div>
                  </div>
                </Flex>
                <Space>
                  <Button
                    type="default"
                    icon={<EditOutlined />}
                    onClick={() => startEdit(c)}
                    aria-label="ویرایش"
                  />
                  <Popconfirm
                    title="حذف دسته"
                    description={`دسته «${c.name}» حذف شود؟`}
                    okText="حذف"
                    cancelText="انصراف"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteMutation.mutate(c._id)}
                  >
                    <Button
                      type="default"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deleteMutation.isPending}
                      aria-label="حذف"
                    />
                  </Popconfirm>
                </Space>
              </Flex>
            </Card>
          </List.Item>
        )}
      />
    </Space>
  );
}
