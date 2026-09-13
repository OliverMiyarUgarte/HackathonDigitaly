"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime/socket-context";
import { ConsultationNotifications } from "@/lib/realtime/use-consultation-notifications";
import type { UserRole } from "@/lib/contracts";
import { AppShell } from "./app-shell";

export interface RoleShellProps {
  role: UserRole;
  children: ReactNode;
}

export function RoleShell({ role, children }: RoleShellProps) {
  return (
    <RequireRole roles={[role]}>
      <RealtimeProvider>
        <ConsultationNotifications />
        <AppShell role={role}>{children}</AppShell>
      </RealtimeProvider>
    </RequireRole>
  );
}
