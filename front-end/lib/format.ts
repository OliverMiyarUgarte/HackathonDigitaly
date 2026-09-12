const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Sao_Paulo",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function formatDate(value: string | Date): string {
  const date = toDate(value);
  return isValidDate(date) ? dateFormatter.format(date) : "Data indisponível";
}

export function formatTime(value: string | Date): string {
  const date = toDate(value);
  return isValidDate(date) ? timeFormatter.format(date) : "Horário indisponível";
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return isValidDate(date)
    ? dateTimeFormatter.format(date)
    : "Data e horário indisponíveis";
}

export function formatDateTimeWithContext(value: string | Date): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

export function formatNumber(value: number, unit?: string): string {
  const formatted = numberFormatter.format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Tamanho indisponível";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = unitIndex === 0 ? size : Math.round(size * 10) / 10;
  return `${numberFormatter.format(rounded)} ${units[unitIndex]}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "Duração indisponível";
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes === 0) {
    return `${formatNumber(seconds)} s`;
  }
  return `${formatNumber(minutes)} min ${formatNumber(seconds)} s`;
}

export function formatCrm(crm: string | null): string {
  return crm ? `CRM ${crm}` : "CRM não informado";
}

export function formatSpecialty(specialty: string | null): string {
  return specialty ?? "Especialidade não informada";
}
