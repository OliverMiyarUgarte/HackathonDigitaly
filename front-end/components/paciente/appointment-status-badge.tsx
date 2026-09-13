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

export interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  live?: boolean;
}

export function AppointmentStatusBadge({
  status,
  live,
}: AppointmentStatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      live={live ?? status === "in_progress"}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
