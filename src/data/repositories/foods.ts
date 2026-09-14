import { db, type NutriCalDatabase } from '@/data/db';
import { ALIVE, fromStoredFood, toStoredFood } from '@/data/stored';
import { asDeleted } from '@/data/tombstone';
import type { Food } from '@/domain/food/food';
import type { FoodId } from '@/domain/identity/ids';
import { now, type Instant } from '@/domain/time/local-date';
import { normalizeForSearch } from '@contracts/text';

/**
 * Catálogo local de alimentos.
 *
 * Guarda todo lo que se ha consultado alguna vez, de modo que la búsqueda pueda
 * mirar aquí antes de salir a la red. Eso ahorra peticiones a Open Food Facts,
 * que es justo lo que sus condiciones de uso piden, y hace que la aplicación
 * siga encontrando lo que ya conoces cuando no hay conexión.
 *
 * El repositorio recibe la base de datos como parámetro en lugar de usar la
 * global. Es inyección de dependencias sin ningún framework: los tests crean una
 * base de datos aparte y el resto del código usa la instancia por defecto.
 */
export function createFoodRepository(database: NutriCalDatabase) {
  return {
    /**
     * Inserta o reemplaza. El texto de búsqueda se recalcula aquí, así que no
     * puede quedar desfasado respecto al nombre o la marca.
     */
    async save(food: Food): Promise<void> {
      await database.foods.put(toStoredFood(food));
    },

    async saveMany(foods: readonly Food[]): Promise<void> {
      await database.foods.bulkPut(foods.map(toStoredFood));
    },

    /**
     * Devuelve el alimento solo si no está borrado. Aquí la comprobación sigue
     * siendo en memoria porque la lectura es por clave primaria y devuelve una
     * sola fila: no hay nada que un índice pueda ahorrar.
     */
    async byId(id: FoodId): Promise<Food | undefined> {
      const stored = await database.foods.get(id);
      if (stored?.isDeleted !== ALIVE) {
        return undefined;
      }
      return fromStoredFood(stored);
    },

    /**
     * Incluye los borrados. Lo necesita la exportación, que tiene que propagar
     * las lápidas, y nada más.
     */
    async byIdIncludingDeleted(id: FoodId): Promise<Food | undefined> {
      const stored = await database.foods.get(id);
      return stored === undefined ? undefined : fromStoredFood(stored);
    },

    /**
     * Búsqueda exacta por código de barras, la vía del escáner y del teclado.
     * El índice compuesto devuelve directamente solo lo vivo.
     */
    async byBarcode(barcode: string): Promise<Food | undefined> {
      const stored = await database.foods
        .where('[isDeleted+source.barcode]')
        .equals([ALIVE, barcode])
        .first();
      return stored === undefined ? undefined : fromStoredFood(stored);
    },

    /**
     * Búsqueda por texto dentro de lo ya conocido.
     *
     * Recorre las filas vivas y compara contra el texto normalizado que se
     * guardó al escribir, en lugar de usar un índice de prefijo. El motivo es que
     * un índice de prefijo no encontraría "Danone" dentro de "Yogur natural
     * Danone", y este catálogo solo contiene los alimentos que esta persona ha
     * consultado, así que son decenas o cientos de filas, no millones. Si algún
     * día esta tabla creciera de verdad, la vía es un índice de palabras y se
     * registrará como decisión.
     */
    async searchByName(query: string, limit = 20): Promise<readonly Food[]> {
      const needle = normalizeForSearch(query);
      if (needle === '') {
        return [];
      }

      const found: Food[] = [];
      await database.foods
        .where('isDeleted')
        .equals(ALIVE)
        .until(() => found.length >= limit, true)
        .each((stored) => {
          if (found.length < limit && stored.searchText.includes(needle)) {
            found.push(fromStoredFood(stored));
          }
        });

      return found;
    },

    /** Borrado lógico: escribe la lápida, no elimina la fila. */
    async remove(id: FoodId, at: Instant = now()): Promise<void> {
      const stored = await database.foods.get(id);
      if (stored === undefined) {
        return;
      }
      await database.foods.put(toStoredFood(asDeleted(fromStoredFood(stored), at)));
    },

    /** Todo lo vivo. Pensado para diagnósticos y para el sembrado de ejemplo. */
    async all(): Promise<readonly Food[]> {
      const stored = await database.foods.where('isDeleted').equals(ALIVE).toArray();
      return stored.map(fromStoredFood);
    },
  };
}

export const foodRepository = createFoodRepository(db);
