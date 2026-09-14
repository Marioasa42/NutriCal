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

/**
 * Quita la lápida: deshace un borrado.
 *
 * Deshacer es **quitar el campo**, no ponerlo a `undefined`. Con
 * `exactOptionalPropertyTypes` activado, escribir `{ ...entity, deletedAt:
 * undefined }` no compila, y eso es exactamente lo que se quiere: el tipo dice
 * que la clave está o no está, así que no existen dos formas de decir "viva".
 * Es D-001 aplicado por el compilador a la propia lápida. Por eso se omite
 * desestructurando, que es el mismo recurso que usa `fromStored` para quitar
 * `isDeleted`.
 *
 * La aserción de tipo tiene el mismo motivo que la de `fromStored`: TypeScript
 * no sabe demostrar que quitarle una propiedad opcional a un genérico `T` deja
 * otra vez un `T`, aunque lo sea. `isDeleted` se recalcula solo al escribir,
 * porque `toStored` lo deriva de `deletedAt` en un único sitio (D-014), así que
 * no hay que acordarse de nada más.
 *
 * `updatedAt` se toca igual que al borrar: para la sincronización de la fase 4,
 * resucitar es un cambio como cualquier otro y tiene que competir en el mismo
 * orden temporal que un borrado o una edición.
 */
export const asRestored = <T extends Persisted>(entity: T, at: Instant): T => {
  const { deletedAt: _tombstone, ...alive } = entity;
  return { ...alive, updatedAt: at } as unknown as T;
};

/** Marca una entidad como modificada ahora mismo. */
export const asTouched = <T extends Persisted>(entity: T, at: Instant): T => ({
  ...entity,
  updatedAt: at,
});
