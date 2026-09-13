import {
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  Radio,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABELS } from "@/lib/appointments";
import type { AppointmentStatus } from "@/lib/contracts";

const STATUS_VARIANTS: Record<AppointmentStatus, BadgeVariant> = {
  pending_code: "warning",
  confirmed: "brand",
  in_progress: "success",
  completed: "neutral",
  cancelled: "error",
};

const STATUS_ICONS: Record<AppointmentStatus, LucideIcon> = {
  pending_code: Clock3,
  confirmed: CalendarCheck2,
  in_progress: Radio,
  completed: CheckCircle2,
  cancelled: XCircle,
};

export interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  live?: boolean;
}

export function AppointmentStatusBadge({
  status,
  live,
}: AppointmentStatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      live={live ?? status === "in_progress"}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
