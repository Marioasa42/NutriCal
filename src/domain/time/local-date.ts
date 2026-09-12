import type { Brand } from '@/domain/brand';
import { invariant } from '@/shared/lib/invariant';

/**
 * Un "día" del diario es una cadena `YYYY-MM-DD` calculada en la zona horaria de
 * la persona usuaria, nunca un instante UTC.
 *
 * El motivo: si guardaras la cena del 12 de septiembre a las 22:30 en Madrid como
 * un instante UTC, sería el 12 a las 20:30 y funcionaría. Pero una cena a las
 * 00:30 se guardaría como el día siguiente en Madrid y como el mismo día en
 * Nueva York. El día al que pertenece una comida es una decisión humana y local,
 * no una consecuencia del huso horario del servidor.
 */
export type LocalDate = Brand<string, 'LocalDate'>;

/**
 * Un instante absoluto en formato ISO 8601 con zona, para auditoría y para
 * ordenar cambios cuando llegue la sincronización. Es lo contrario de
 * `LocalDate`: aquí sí queremos un punto único en la línea del tiempo.
 */
export type Instant = Brand<string, 'Instant'>;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valida y marca una cadena `YYYY-MM-DD`. */
export function localDate(value: string): LocalDate {
  invariant(
    LOCAL_DATE_PATTERN.test(value),
    `localDate: se esperaba el formato YYYY-MM-DD, se recibió "${value}"`,
  );
  invariant(isRealCalendarDate(value), `localDate: "${value}" no es una fecha real del calendario`);
  return value as LocalDate;
}

/** Valida y marca un instante ISO 8601. */
export function instant(value: string): Instant {
  const parsed = new Date(value);
  invariant(!Number.isNaN(parsed.getTime()), `instant: "${value}" no es una fecha ISO válida`);
  return parsed.toISOString() as Instant;
}

/** El instante actual. Se pasa como parámetro en los tests para no depender del reloj. */
export const now = (clock: Date = new Date()): Instant => clock.toISOString() as Instant;

/**
 * El día natural correspondiente a un instante, en la zona horaria indicada.
 *
 * Usa `Intl.DateTimeFormat` con `formatToParts` en lugar de aritmética manual
 * porque el navegador ya conoce la base de datos de husos horarios, incluidos
 * los cambios de hora y sus excepciones históricas.
 */
export function toLocalDate(at: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);

  const year = findPart(parts, 'year');
  const month = findPart(parts, 'month');
  const day = findPart(parts, 'day');

  return localDate(`${year}-${month}-${day}`);
}

/** El día de hoy en la zona horaria indicada. */
export const today = (timeZone: string, clock: Date = new Date()): LocalDate =>
  toLocalDate(clock, timeZone);

/** Suma días naturales. Sirve para moverse por el diario sin tocar husos horarios. */
export function addDays(date: LocalDate, days: number): LocalDate {
  invariant(Number.isInteger(days), `addDays: se esperaba un entero, se recibió ${days}`);
  // Se opera a mediodía UTC para que ningún cambio de hora pueda desplazar el día.
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return toLocalDate(base, 'UTC');
}

/** Orden natural entre días. Las cadenas `YYYY-MM-DD` ya ordenan alfabéticamente. */
export const compareLocalDates = (a: LocalDate, b: LocalDate): number => a.localeCompare(b);

function findPart(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const part = parts.find((candidate) => candidate.type === type);
  invariant(part !== undefined, `toLocalDate: falta la parte "${type}" en el formato`);
  return part.value;
}

function isRealCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  // Descarta cosas como "2026-02-31", que JavaScript desplazaría a marzo.
  return parsed.toISOString().startsWith(value);
}
