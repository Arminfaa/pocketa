"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const RegisterSchema = z
  .object({
    name: z.string().min(2, "نام را وارد کنید"),
    email: z.string().email("ایمیل معتبر وارد کنید"),
    password: z.string().min(8, "حداقل ۸ کاراکتر"),
    avatar: z.string().url("آدرس تصویر معتبر است").optional().or(z.literal("")),
  })
  .transform((v) => ({
    ...v,
    avatar: v.avatar ? v.avatar : null,
  }));

type RegisterForm = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: "", email: "", password: "", avatar: "" },
  });

  async function onSubmit(values: RegisterForm) {
    try {
      const res = await api.post("/api/auth/register", values);
      toast.success(res.data?.message ?? "ثبت‌نام انجام شد");

      // Auto login for better UX.
      const loginRes = await api.post("/api/auth/login", {
        email: values.email,
        password: values.password,
      });
      const payload = loginRes.data?.data;
      setAccessToken(payload?.accessToken ?? null);
      setUser(payload?.user ?? null);
      router.replace("/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.message ?? "خطای نامشخص";
      toast.error(message);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-center text-[var(--text)] mb-2">
          ثبت‌نام در Pocketa
        </h1>
        <p className="text-center text-[var(--muted)] mb-6">ثبت‌نام شما تنها چند ثانیه زمان می‌برد.</p>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <label className="text-sm text-[var(--muted)]">
            نام
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              type="text"
              dir="rtl"
              {...form.register("name")}
            />
          </label>
          {form.formState.errors.name?.message ? (
            <div className="text-sm text-red-500">{form.formState.errors.name.message}</div>
          ) : null}

          <label className="text-sm text-[var(--muted)]">
            ایمیل
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              type="email"
              dir="ltr"
              {...form.register("email")}
            />
          </label>
          {form.formState.errors.email?.message ? (
            <div className="text-sm text-red-500">{form.formState.errors.email.message}</div>
          ) : null}

          <label className="text-sm text-[var(--muted)]">
            رمز عبور
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              type="password"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.password?.message ? (
            <div className="text-sm text-red-500">{form.formState.errors.password.message}</div>
          ) : null}

          <label className="text-sm text-[var(--muted)]">
            آواتار (اختیاری)
            <input
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-3 outline-none focus:ring-2 focus:ring-[var(--ring)]"
              type="url"
              placeholder="https://..."
              dir="ltr"
              {...form.register("avatar")}
            />
          </label>

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="mt-2 rounded-xl bg-brand-500 text-white py-3 px-4 font-medium hover:opacity-95 disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "در حال ثبت‌نام..." : "ثبت‌نام"}
          </button>

          <div className="text-center text-sm">
            حساب دارید؟{" "}
            <a className="text-brand-500 font-medium" href="/login">
              ورود
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}

