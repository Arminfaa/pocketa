"use client";

import { useRef, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);

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

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("فقط فایل تصویری مجاز است");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم فایل بیشتر از ۵ مگابایت است");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setUploading(true);
    try {
      const res = await api.post("/api/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const nextUser = res.data?.data?.user;
      if (nextUser) setUser(nextUser);
      toast.success("آواتار به‌روزرسانی شد");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در آپلود تصویر";
      toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onSaveProfile() {
    if (!name.trim() || name.trim().length < 2) {
      toast.error("نام باید حداقل ۲ کاراکتر باشد");
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/api/profile", { name: name.trim() });
      const nextUser = res.data?.data?.user;
      if (nextUser) setUser(nextUser);
      toast.success("پروفایل ذخیره شد");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "خطا در ذخیره پروفایل";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold text-[var(--text)]">تنظیمات پروفایل</h1>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative h-20 w-20 rounded-2xl overflow-hidden border border-[var(--border)] bg-brand-gradient flex items-center justify-center group"
            aria-label="آپلود آواتار"
          >
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-bold text-white">
                {(user?.name ?? "پ").charAt(0)}
              </span>
            )}
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploading ? (
                <Loader2 className="animate-spin text-white" size={22} />
              ) : (
                <Camera className="text-white" size={22} />
              )}
            </div>
          </button>

          <div>
            <div className="font-medium">{user?.name ?? "—"}</div>
            <div className="text-sm text-[var(--muted)]">{user?.email ?? ""}</div>
            <p className="text-xs text-[var(--muted)] mt-2">
              JPEG / PNG / WebP — حداکثر ۵ مگابایت
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onAvatarChange}
          />
        </div>

        <label className="block text-sm text-[var(--muted)]">
          نام نمایشی
          <input
            className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={onSaveProfile}
          disabled={saving}
          className="rounded-xl bg-brand-500 text-white px-4 py-3 font-medium hover:opacity-95 disabled:opacity-60"
        >
          {saving ? "در حال ذخیره..." : "ذخیره تغییرات"}
        </button>
      </div>

      <button
        onClick={onLogout}
        className="rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 font-medium hover:bg-white/5"
      >
        خروج از حساب
      </button>
    </div>
  );
}
