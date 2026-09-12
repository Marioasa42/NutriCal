import type { Instant } from '@/domain/time/local-date';

/**
 * Campos comunes a toda entidad que se guarda en disco.
 *
 * `deletedAt` es una lápida: borrar no elimina la fila, escribe la fecha del
 * borrado. Sin lápidas, la sincronización entre dispositivos no puede distinguir
 * un registro que nunca llegó a un móvil de uno que se borró allí, y los
 * registros eliminados resucitarían en la siguiente sincronización.
 *
 * Regla que acompaña al tipo: toda consulta del repositorio excluye las entidades
 * con lápida, salvo que pida explícitamente incluirlas. La exportación sí las
 * incluye, porque el borrado también es información que hay que propagar.
 */
export interface Persisted {
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly deletedAt?: Instant;
}

/** Una entidad está viva si no tiene lápida. */
export const isAlive = (entity: Persisted): boolean => entity.deletedAt === undefined;

/** Filtra una colección dejando solo lo no borrado. */
export const onlyAlive = <T extends Persisted>(entities: readonly T[]): readonly T[] =>
  entities.filter(isAlive);
