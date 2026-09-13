import type { ComponentType } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileHeart,
  Home,
  Users,
} from "lucide-react";
import type { UserRole } from "@/lib/contracts";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: Record<UserRole, readonly NavItem[]> = {
  patient: [
    { label: "Início", href: "/paciente", icon: Home },
    { label: "Agendar", href: "/paciente/agendar", icon: CalendarPlus },
    { label: "Calendário", href: "/paciente/calendario", icon: CalendarDays },
    { label: "Histórico", href: "/paciente/historico", icon: ClipboardList },
    { label: "Prontuário", href: "/paciente/prontuario", icon: FileHeart },
  ],
  doctor: [
    { label: "Início", href: "/medico", icon: Home },
    { label: "Atendimentos", href: "/medico/atendimentos", icon: ClipboardList },
    { label: "Pacientes", href: "/medico/pacientes", icon: Users },
    { label: "Prontuário", href: "/medico/prontuario", icon: FileHeart },
  ],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  patient: "Paciente",
  doctor: "Médico",
};

export function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }
  const segments = href.split("/").filter(Boolean);
  return segments.length > 1 && pathname.startsWith(`${href}/`);
}
