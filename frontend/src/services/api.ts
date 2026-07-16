"use client";

import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth.store";

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

if (!process.env.NEXT_PUBLIC_API_URL) {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_URL is not set; falling back to http://localhost:4000");
}

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const apiNoAuth = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = apiNoAuth
      .post("/api/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  await refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const url = original?.url ?? "";

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !url.includes("/api/auth/login") &&
      !url.includes("/api/auth/register") &&
      !url.includes("/api/auth/refresh")
    ) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
