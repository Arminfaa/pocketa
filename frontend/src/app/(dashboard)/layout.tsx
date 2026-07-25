import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAppUnlock } from "@/components/app-lock/RequireAppUnlock";
import AppLayout from "@/components/layout/AppLayout";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireAppUnlock>
        <AppLayout>{children}</AppLayout>
      </RequireAppUnlock>
    </RequireAuth>
  );
}
