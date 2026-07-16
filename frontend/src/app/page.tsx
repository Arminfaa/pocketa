import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-soft">
        <h1 className="text-2xl font-semibold text-center text-[var(--text)] mb-2">
          خوش آمدید به Pocketa
        </h1>
        <p className="text-center text-[var(--muted)] mb-6">
          مدیریت درآمدها، هزینه‌ها و بودجه‌بندی به شکل حرفه‌ای.
        </p>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="flex-1 inline-flex items-center justify-center rounded-xl bg-brand-500 text-white py-3 px-4 hover:opacity-95"
          >
            ورود
          </Link>
          <Link
            href="/register"
            className="flex-1 inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-transparent py-3 px-4 hover:bg-white/5"
          >
            ثبت‌نام
          </Link>
        </div>
      </div>
    </main>
  );
}

