import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import AppLayout from "@/components/layout/AppLayout";
import { AppShellSkeleton } from "@/components/skeletons";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <RequireAuth>
        <AppLayout>{children}</AppLayout>
      </RequireAuth>
    </Suspense>
  );
}
