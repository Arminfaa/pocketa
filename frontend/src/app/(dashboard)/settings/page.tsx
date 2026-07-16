"use client";

import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  async function onLogout() {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // ignore
    } finally {
      logout();
      toast.success("خارج شدید");
      router.replace("/login");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[var(--text)]">تنظیمات پروفایل</h1>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="text-sm text-[var(--muted)]">اطلاعات کاربر</div>
        <div className="mt-2 font-medium">{user?.name ?? "—"}</div>
        <div className="text-sm text-[var(--muted)]">{user?.email ?? ""}</div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onLogout}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95"
        >
          خروج
        </button>
        <button
          className="rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 font-medium hover:bg-white/5"
          type="button"
        >
          ویرایش (دمو)
        </button>
      </div>
    </div>
  );
}

