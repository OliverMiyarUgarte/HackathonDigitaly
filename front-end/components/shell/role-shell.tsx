"use client";

import type { ReactNode } from "react";
import { RequireRole } from "@/lib/auth";
import type { UserRole } from "@/lib/contracts";
import { AppShell } from "./app-shell";

export interface RoleShellProps {
  role: UserRole;
  children: ReactNode;
}

export function RoleShell({ role, children }: RoleShellProps) {
  return (
    <RequireRole roles={[role]}>
      <AppShell role={role}>{children}</AppShell>
    </RequireRole>
  );
}
