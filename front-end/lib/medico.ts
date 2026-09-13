import { toSaoPauloDateKey } from "@/lib/appointments";
import type {
  AppointmentStatus,
  ConsultationDto,
  DoctorAppointmentDto,
} from "@/lib/contracts";

export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

export function doctorDayQuery(dateKey: string): string {
  return `${dateKey}T00:00:00-03:00`;
}

export function todaySaoPauloKey(now: Date = new Date()): string {
  return toSaoPauloDateKey(now);
}

export interface DoctorAgendaCounts {
  total: number;
  confirmed: number;
  inProgress: number;
  pendingCode: number;
  completed: number;
  cancelled: number;
}

export function countDoctorAppointments(
  appointments: readonly DoctorAppointmentDto[],
): DoctorAgendaCounts {
  const counts: DoctorAgendaCounts = {
    total: appointments.length,
    confirmed: 0,
    inProgress: 0,
    pendingCode: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const appointment of appointments) {
    switch (appointment.status) {
      case "confirmed":
        counts.confirmed += 1;
        break;
      case "in_progress":
        counts.inProgress += 1;
        break;
      case "pending_code":
        counts.pendingCode += 1;
        break;
      case "completed":
        counts.completed += 1;
        break;
      case "cancelled":
        counts.cancelled += 1;
        break;
    }
  }
  return counts;
}

const ACTIONABLE_STATUSES: readonly AppointmentStatus[] = [
  "in_progress",
  "confirmed",
  "pending_code",
];

export function isActionableAppointment(status: AppointmentStatus): boolean {
  return ACTIONABLE_STATUSES.includes(status);
}

function scheduledTime(appointment: DoctorAppointmentDto): number {
  const value = new Date(appointment.scheduledAt).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

export function pickNextDoctorAppointment(
  appointments: readonly DoctorAppointmentDto[],
  now: Date = new Date(),
): DoctorAppointmentDto | null {
  const inProgress = appointments.find(
    (appointment) =>
      appointment.status === "in_progress" && appointment.consultationId,
  );
  if (inProgress) {
    return inProgress;
  }

  const reference = now.getTime();
  const confirmed = appointments
    .filter((appointment) => appointment.status === "confirmed")
    .sort((left, right) => scheduledTime(left) - scheduledTime(right));
  const currentOrNext = confirmed.find(
    (appointment) => scheduledTime(appointment) >= reference - 60 * 60 * 1000,
  );
  if (currentOrNext) {
    return currentOrNext;
  }
  if (confirmed.length > 0) {
    return confirmed[0];
  }

  const pending = appointments
    .filter((appointment) => appointment.status === "pending_code")
    .sort((left, right) => scheduledTime(left) - scheduledTime(right));
  return pending[0] ?? null;
}

export function consultationDurationSeconds(
  consultation: Pick<ConsultationDto, "startedAt" | "endedAt">,
  now: Date = new Date(),
): number | null {
  const start = new Date(consultation.startedAt).getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const end = consultation.endedAt
    ? new Date(consultation.endedAt).getTime()
    : now.getTime();
  if (Number.isNaN(end) || end < start) {
    return null;
  }
  return Math.floor((end - start) / 1000);
}

