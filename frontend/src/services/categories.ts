"use client";

import api from "@/services/api";

export type Category = {
  _id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
};

export async function fetchCategories(): Promise<Category[]> {
  const res = await api.get("/api/categories");
  return res.data?.data?.items ?? [];
}

export async function createCategory(payload: {
  name: string;
  type: "income" | "expense";
  icon: string;
  color: string;
}): Promise<Category> {
  const res = await api.post("/api/categories", payload);
  return res.data.data.item as Category;
}

export async function updateCategory(
  id: string,
  payload: Partial<{
    name: string;
    type: "income" | "expense";
    icon: string;
    color: string;
  }>
): Promise<Category> {
  const res = await api.put(`/api/categories/${id}`, payload);
  return res.data.data.item as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/api/categories/${id}`);
}
