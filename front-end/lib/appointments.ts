import type {
  AppointmentStatus,
  CalendarEntryDto,
  PreConsultQuestionKey,
  SlotDto,
} from "@/lib/contracts";

export interface PreConsultQuestion {
  key: PreConsultQuestionKey;
  label: string;
  placeholder: string;
}

export const PRE_CONSULT_QUESTIONS: readonly PreConsultQuestion[] = [
  {
    key: "chief_complaint",
    label: "Queixa principal",
    placeholder: "O que motivou a consulta",
  },
  {
    key: "symptom_duration",
    label: "Duração dos sintomas",
    placeholder: "Há quanto tempo os sintomas começaram",
  },
  {
    key: "current_medications",
    label: "Medicamentos em uso",
    placeholder: "Medicamentos atuais e doses",
  },
  {
    key: "allergies",
    label: "Alergias",
    placeholder: "Alergias conhecidas ou informe que não há",
  },
  {
    key: "medical_history",
    label: "Histórico médico",
    placeholder: "Condições, cirurgias e acompanhamentos",
  },
];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_code: "Aguardando confirmação",
  confirmed: "Confirmada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export function preConsultLabel(key: string): string {
  return PRE_CONSULT_QUESTIONS.find((question) => question.key === key)?.label ?? key;
}

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const dateKeyLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: "America/Sao_Paulo",
});

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function toSaoPauloDateKey(value: string | Date): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = dateKeyFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export function formatDateKeyLabel(key: string): string {
  const date = new Date(`${key}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) {
    return key;
  }
  const text = dateKeyLabelFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthAnchorFor(value: string | Date): string {
  const key = toSaoPauloDateKey(value);
  return `${key.slice(0, 7)}-01`;
}

export function addMonthsToAnchor(anchor: string, delta: number): string {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${nextYear}-${nextMonth}-01`;
}

export function anchorMonthRange(anchor: string): { from: string; to: string } {
  const next = addMonthsToAnchor(anchor, 1);
  return {
    from: `${anchor}T00:00:00-03:00`,
    to: `${next}T00:00:00-03:00`,
  };
}

export function formatMonthLabel(anchor: string): string {
  const date = new Date(`${anchor}T12:00:00-03:00`);
  if (Number.isNaN(date.getTime())) {
    return anchor;
  }
  const text = monthLabelFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface MonthCell {
  key: string | null;
  day: number | null;
}

export function buildMonthMatrix(anchor: string): MonthCell[][] {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthCell[] = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const paddedMonth = String(month).padStart(2, "0");
    const paddedDay = String(day).padStart(2, "0");
    cells.push({ key: `${year}-${paddedMonth}-${paddedDay}`, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ key: null, day: null });
  }
  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export interface SlotDayGroup {
  key: string;
  label: string;
  slots: SlotDto[];
}

export function groupSlotsByDay(slots: SlotDto[]): SlotDayGroup[] {
  const groups = new Map<string, SlotDto[]>();
  for (const slot of slots) {
    const key = toSaoPauloDateKey(slot.startsAt);
    const list = groups.get(key) ?? [];
    list.push(slot);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, list]) => ({
      key,
      label: formatDateKeyLabel(key),
      slots: list.sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
    }));
}

export function splitCalendarEntries(
  entries: CalendarEntryDto[],
  now: Date = new Date(),
): { upcoming: CalendarEntryDto[]; previous: CalendarEntryDto[] } {
  const reference = now.getTime();
  const upcoming: CalendarEntryDto[] = [];
  const previous: CalendarEntryDto[] = [];
  for (const entry of entries) {
    if (new Date(entry.scheduledAt).getTime() >= reference) {
      upcoming.push(entry);
    } else {
      previous.push(entry);
    }
  }
  upcoming.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  previous.sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt));
  return { upcoming, previous };
}

export function pickNextAppointment(
  entries: CalendarEntryDto[],
  now: Date = new Date(),
): CalendarEntryDto | null {
  const inProgress = entries.find(
    (entry) => entry.status === "in_progress" && entry.consultationId,
  );
  if (inProgress) {
    return inProgress;
  }
  const reference = now.getTime();
  const upcoming = entries
    .filter(
      (entry) =>
        (entry.status === "pending_code" || entry.status === "confirmed") &&
        new Date(entry.scheduledAt).getTime() >= reference,
    )
    .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
  return upcoming[0] ?? null;
}

export function isCancellable(status: AppointmentStatus): boolean {
  return status !== "completed" && status !== "cancelled";
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) {
    return "seu e-mail cadastrado";
  }
  const [local, domain] = email.split("@");
  if (!local || !domain) {
    return "seu e-mail cadastrado";
  }
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}
