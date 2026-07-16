"use client";

import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth.store";

const baseURL = process.env.NEXT_PUBLIC_API_URL;

if (!baseURL) {
  // eslint-disable-next-line no-console
  console.warn("NEXT_PUBLIC_API_URL is not set");
}

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const apiNoAuth = axios.create({
  baseURL,
  withCredentials: true,
});

async function refreshToken(): Promise<string> {
  const res = await apiNoAuth.post("/api/auth/refresh");
  const accessToken = res.data?.data?.accessToken as string | undefined;
  if (!accessToken) throw new Error("Refresh failed");
  useAuthStore.getState().setAccessToken(accessToken);
  return accessToken;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await refreshToken();
        return api(original);
      } catch {
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(error);
  }
);

export default api;
