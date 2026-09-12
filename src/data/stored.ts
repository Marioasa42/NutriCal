import type { Food } from '@/domain/food/food';
import type { Persisted } from '@/domain/persistence/persisted';
import { normalizeForSearch } from '@/shared/lib/text';

/**
 * Forma en la que las entidades viven dentro de IndexedDB.
 *
 * El dominio dice que una entidad está borrada cuando tiene `deletedAt`. Eso es
 * correcto como modelo, pero IndexedDB no indexa las claves ausentes, así que un
 * índice sobre `deletedAt` dejaría fuera justo los registros vivos, que son los
 * que siempre queremos consultar.
 *
 * La solución es un campo que está presente siempre: `isDeleted`, con valor 0 o
 * 1. Es un detalle de almacenamiento, no del dominio, por eso no se añade a
 * `Persisted` sino que se envuelve la entidad al escribir y se desenvuelve al
 * leer. El valor nunca se escribe a mano: se deriva de `deletedAt` en un único
 * sitio, de modo que no pueden contradecirse.
 */
export type DeletedFlag = 0 | 1;

export const ALIVE = 0 satisfies DeletedFlag;
export const DELETED = 1 satisfies DeletedFlag;

export type Stored<T> = T & { readonly isDeleted: DeletedFlag };

/**
 * Los alimentos guardan además el texto ya normalizado para buscar. Calcularlo
 * al escribir, una vez, en lugar de recalcularlo en cada búsqueda y por cada
 * fila, que era lo que hacía la primera versión.
 */
export type StoredFood = Stored<Food> & { readonly searchText: string };

export function toStored<T extends Persisted>(entity: T): Stored<T> {
  return { ...entity, isDeleted: entity.deletedAt === undefined ? ALIVE : DELETED };
}

/**
 * Desenvuelve una entidad genérica.
 *
 * Lleva una aserción de tipo porque TypeScript no sabe demostrar que quitarle
 * `isDeleted` a un `Stored<T>` deja exactamente un `T`, al ser `T` un parámetro
 * genérico. Es el único punto del proyecto fuera de los constructores de
 * unidades donde aparece una aserción, y está confinado a este archivo.
 */
export function fromStored<T extends Persisted>(stored: Stored<T>): T {
  const { isDeleted: _flag, ...entity } = stored;
  return entity as unknown as T;
}

export function toStoredFood(food: Food): StoredFood {
  return {
    ...toStored(food),
    searchText: normalizeForSearch(`${food.name} ${food.brand ?? ''}`),
  };
}

/**
 * Desenvuelve un alimento. Aquí no hace falta aserción: el tipo es concreto, así
 * que TypeScript comprueba por sí solo que lo que queda tras quitar los dos
 * campos de almacenamiento es exactamente un `Food`.
 */
export function fromStoredFood(stored: StoredFood): Food {
  const { isDeleted: _flag, searchText: _searchText, ...food } = stored;
  return food;
}
