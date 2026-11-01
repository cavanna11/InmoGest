import { err, ok, type Result } from './result.ts';

/**
 * Fechas (PRD §6 Agenda, docs/DATABASE.md).
 * - La base guarda timestamptz en UTC.
 * - Se muestran en America/Argentina/Buenos_Aires, formato DD/MM/AAAA y 24 h.
 * - Se usa Intl (sin dependencias); no se asume un desfase fijo.
 */

export const TIME_ZONE = 'America/Argentina/Buenos_Aires';

export type CalendarDate = { year: number; month: number; day: number };
export type LocalDateTime = CalendarDate & { hour: number; minute: number };

export type DateErrorCode = 'date_empty' | 'date_invalid' | 'time_invalid';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Fecha y hora en Argentina de un instante. */
export function toLocalParts(instant: Date | string): LocalDateTime & { second: number } {
  const date = toDate(instant);
  const parts: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/** "31/10/2026" */
export function formatDate(instant: Date | string): string {
  const { day, month, year } = toLocalParts(instant);
  return `${pad(day)}/${pad(month)}/${year}`;
}

/** "18:05" */
export function formatTime(instant: Date | string): string {
  const { hour, minute } = toLocalParts(instant);
  return `${pad(hour)}:${pad(minute)}`;
}

/** "31/10/2026 18:05" */
export function formatDateTime(instant: Date | string): string {
  return `${formatDate(instant)} ${formatTime(instant)}`;
}

/** Interpreta "DD/MM/AAAA" (acepta un dígito en día y mes) y valida el calendario. */
export function parseDate(input: string): Result<CalendarDate, DateErrorCode> {
  const value = input.trim();
  if (value === '') return err('date_empty', 'Ingresá una fecha.');
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return invalidDate();
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return invalidDate();
  }
  return ok({ year, month, day });
}

/** Interpreta "HH:mm" en formato 24 h. */
export function parseTime(input: string): Result<{ hour: number; minute: number }, DateErrorCode> {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(input.trim());
  if (!match) return err('time_invalid', 'La hora no es válida. Usá el formato 24 h, por ejemplo 18:30.');
  return ok({ hour: Number(match[1]), minute: Number(match[2]) });
}

/** Fecha y hora de Argentina → instante UTC. */
export function fromLocal(local: LocalDateTime): Date {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  // Se corrige por el desfase de la zona en ese instante (dos pasos por si cruza un cambio de horario).
  let instant = asUtc - offsetMs(new Date(asUtc));
  instant = asUtc - offsetMs(new Date(instant));
  return new Date(instant);
}

/** Desfase de Argentina respecto de UTC en ese instante, en milisegundos (ej. -3 h). */
function offsetMs(instant: Date): number {
  const p = toLocalParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function toDate(instant: Date | string): Date {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (Number.isNaN(date.getTime())) throw new TypeError('Fecha inválida');
  return date;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function invalidDate() {
  return err('date_invalid' as const, 'La fecha no es válida. Usá el formato DD/MM/AAAA.');
}
