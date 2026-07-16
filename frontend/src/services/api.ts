"use client";

import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Local: call backend directly via NEXT_PUBLIC_API_URL (localhost).
 * Production: same-origin "" so requests hit Vercel /api/* rewrites → Render.
 * That keeps auth cookies first-party and working on mobile browsers / iOS PWAs.
 */
function resolveBaseURL(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (
    configured.includes("localhost") ||
    configured.includes("127.0.0.1")
  ) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    return "";
  }
  return configured || "http://localhost:4000";
}

const baseURL = resolveBaseURL();

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const apiNoAuth = axios.create({
  baseURL,
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

export async function refreshSession(): Promise<void> {
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

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path === "/login" || path.startsWith("/login?")) return;
  window.location.replace("/login");
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
        redirectToLogin();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
