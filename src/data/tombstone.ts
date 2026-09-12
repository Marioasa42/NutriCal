import type { Persisted } from '@/domain/persistence/persisted';
import type { Instant } from '@/domain/time/local-date';

/**
 * Marca una entidad como borrada sin eliminarla.
 *
 * Devuelve una copia nueva en lugar de mutar, porque todas las entidades del
 * dominio son de solo lectura. `updatedAt` también se toca: para la
 * sincronización de la fase 4, borrar es un cambio como cualquier otro y tiene
 * que competir en el mismo orden temporal que una edición.
 */
export const asDeleted = <T extends Persisted>(entity: T, at: Instant): T => ({
  ...entity,
  deletedAt: at,
  updatedAt: at,
});

/** Marca una entidad como modificada ahora mismo. */
export const asTouched = <T extends Persisted>(entity: T, at: Instant): T => ({
  ...entity,
  updatedAt: at,
});
