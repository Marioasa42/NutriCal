import type { Instant } from '@/domain/time/local-date';

/**
 * El nombre del archivo descargado, con la fecha en la que se exportó.
 *
 * `Instant` es siempre el resultado de `Date.prototype.toISOString()`
 * (`local-date.ts`), así que los diez primeros caracteres son siempre
 * `YYYY-MM-DD`: no hace falta volver a parsear la fecha para recortarla.
 */
export function exportFileName(exportedAt: Instant): string {
  return `nutrical-${exportedAt.slice(0, 10)}.json`;
}
