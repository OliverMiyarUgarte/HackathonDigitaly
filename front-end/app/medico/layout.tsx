import type { ReactNode } from "react";
import { RoleShell } from "@/components/shell/role-shell";

export default function MedicoLayout({ children }: { children: ReactNode }) {
  return <RoleShell role="doctor">{children}</RoleShell>;
}
