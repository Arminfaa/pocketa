"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import api from "@/services/api";
import { useAuthStore } from "@/stores/auth.store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const LoginSchema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);

  const form = useForm<LoginForm>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginForm) {
    try {
      const res = await api.post("/api/auth/login", values);
      const payload = res.data?.data;
      const accessToken = payload?.accessToken as string | undefined;
      const user = payload?.user as any;
      if (!accessToken) throw new Error("Access token missing");

      setAccessToken(accessToken);
      setUser(user ?? null);
      toast.success("ورود موفقیت‌آمیز بود");
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
          ورود به Pocketa
        </h1>
        <p className="text-center text-[var(--muted)] mb-6">برای ادامه وارد حساب کاربری شوید.</p>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
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

          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="mt-2 rounded-xl bg-brand-500 text-white py-3 px-4 font-medium hover:opacity-95 disabled:opacity-60"
          >
            {form.formState.isSubmitting ? "در حال ورود..." : "ورود"}
          </button>

          <div className="text-center text-sm">
            حساب ندارید؟{" "}
            <a className="text-brand-500 font-medium" href="/register">
              ثبت‌نام
            </a>
          </div>
        </form>
      </div>
    </main>
  );
}

