"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Col, Flex, Input, Popconfirm, Row, Space, Tag, Typography } from "antd";
import { AppstoreOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
  type Category,
} from "@/services/categories";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/finance-ui";
import { CategoriesListSkeleton } from "@/components/skeletons";
import { QueryError } from "@/components/ui/query-error";
import { EmptyState } from "@/components/ui/empty-state";
import { FinanceTypeToggle } from "@/components/ui/finance-type-toggle";
import { PageShell } from "@/components/ui/page-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SoftAvatar, SoftList, SoftListItem, SoftListRow } from "@/components/ui/soft-list";
import { cn } from "@/lib/cn";

const { Text } = Typography;

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
  const [formOpen, setFormOpen] = useState(false);
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
      setFormOpen(false);
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
    setFormOpen(true);
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
    setFormOpen(false);
  }

  function toggleForm() {
    if (formOpen && !editingId) {
      setFormOpen(false);
      setForm(emptyForm);
      return;
    }
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  return (
    <PageShell width="form">
      <PageHeader
        icon={<AppstoreOutlined />}
        title="دسته‌بندی‌ها"
        description="دسته‌های درآمد و هزینه را با رنگ و آیکون مدیریت کنید."
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={toggleForm}
            aria-label={formOpen && !editingId ? "بستن فرم" : "افزودن دسته"}
          />
        }
        extra={
          <FinanceTypeToggle withAll value={filter} onChange={(e) => setFilter(e.target.value)} />
        }
      />

      {formOpen || editingId ? (
        <Card
          title={
            <Space>
              <PlusOutlined />
              {editingId ? "ویرایش دسته" : "افزودن دسته جدید"}
            </Space>
          }
        >
          <Space orientation="vertical" size="middle" className="w-full">
            <Row gutter={[12, 12]}>
              <Col xs={24} md={14}>
                <Text type="secondary">نام</Text>
                <Input
                  className="mt-2"
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="مثلاً خوراک"
                />
              </Col>
              <Col xs={24} md={10}>
                <Text type="secondary">نوع</Text>
                <FinanceTypeToggle
                  className="mt-2"
                  value={form.type}
                  onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))}
                />
              </Col>
            </Row>

            <div>
              <Text type="secondary">رنگ</Text>
              <Flex gap={8} wrap="wrap" className="mt-2">
                {CATEGORY_COLORS.map((c) => (
                  <Button
                    key={c}
                    type="text"
                    aria-label={c}
                    onClick={() => setForm((s) => ({ ...s, color: c }))}
                    className={cn(
                      "w-8 h-8 min-w-8 p-0 rounded-xl",
                      form.color === c
                        ? "border-2 border-white ring-2 ring-brand-500"
                        : "border border-slate-400/20"
                    )}
                    style={{ background: c }}
                  />
                ))}
              </Flex>
            </div>

            <div>
              <Text type="secondary">آیکون</Text>
              <Flex gap={8} wrap="wrap" className="mt-2">
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
      ) : null}

      {q.isLoading ? <CategoriesListSkeleton /> : null}
      {q.error ? (
        <QueryError message="خطا در دریافت دسته‌بندی‌ها." onRetry={() => void q.refetch()} />
      ) : null}

      {!q.isLoading && !q.error && items.length === 0 ? (
        <EmptyState
          title="دسته‌ای یافت نشد"
          description="یک دسته‌بندی جدید بسازید یا فیلتر نوع را تغییر دهید."
        />
      ) : items.length > 0 ? (
        <SoftList>
          {items.map((c) => (
            <SoftListItem key={c._id}>
              <SoftListRow
                leading={
                  <SoftAvatar color={c.color} className="!h-10 !w-10 !rounded-xl text-[10px] font-semibold">
                    {c.icon?.slice(0, 2) ?? "?"}
                  </SoftAvatar>
                }
                title={c.name}
                subtitle={
                  <Space size={4} wrap>
                    <Tag color={c.type === "income" ? "green" : "red"} className="!m-0">
                      {c.type === "income" ? "درآمد" : "هزینه"}
                    </Tag>
                    <span>{c.icon}</span>
                  </Space>
                }
                footer={
                  <Flex gap="small" wrap="wrap">
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
                  </Flex>
                }
              />
            </SoftListItem>
          ))}
        </SoftList>
      ) : null}
    </PageShell>
  );
}
