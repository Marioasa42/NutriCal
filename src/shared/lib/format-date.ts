import type { LocalDate } from '@/domain/time/local-date';

/**
 * Formato de un día del diario para enseñarlo.
 *
 * El detalle que importa es `timeZone: 'UTC'`, y no es un descuido de la
 * decisión 3 de CLAUDE.md: es lo que la hace cumplirse. Un `LocalDate` es una
 * etiqueta de calendario, "el 13 de septiembre", no un instante. Para darle
 * formato hay que fabricar un `Date`, y `new Date('2026-09-13')` es medianoche
 * UTC. Si lo formateáramos en la zona de la persona usuaria, en Los Ángeles esa
 * medianoche cae a las cinco de la tarde del día 12 y la pantalla enseñaría el
 * día anterior al que dice la URL.
 *
 * Fijando UTC en las dos puntas, el `Date` que se construye y el formato que se
 * lee hablan del mismo huso, y los números salen intactos. La zona horaria de
 * verdad ya hizo su trabajo antes, al decidir a qué día pertenecía cada comida.
 */
export function formatLocalDate(date: LocalDate, locale = 'es-ES'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Versión corta, para botones y enlaces donde no cabe el día de la semana. */
export function formatLocalDateShort(date: LocalDate, locale = 'es-ES'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T00:00:00Z`));
}
