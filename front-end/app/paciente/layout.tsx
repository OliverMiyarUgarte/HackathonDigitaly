import type { ReactNode } from "react";
import { RoleShell } from "@/components/shell/role-shell";

export default function PacienteLayout({ children }: { children: ReactNode }) {
  return <RoleShell role="patient">{children}</RoleShell>;
}
