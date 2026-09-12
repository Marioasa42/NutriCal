import { db, type NutriCalDatabase } from '@/data/db';
import { asDeleted } from '@/data/tombstone';
import type { Food } from '@/domain/food/food';
import type { FoodId } from '@/domain/identity/ids';
import { isAlive } from '@/domain/persistence/persisted';
import { now, type Instant } from '@/domain/time/local-date';
import { normalizeForSearch } from '@/shared/lib/text';

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
    /** Inserta o reemplaza. La clave primaria es el identificador del alimento. */
    async save(food: Food): Promise<void> {
      await database.foods.put(food);
    },

    async saveMany(foods: readonly Food[]): Promise<void> {
      await database.foods.bulkPut([...foods]);
    },

    /** Devuelve el alimento solo si no está borrado. */
    async byId(id: FoodId): Promise<Food | undefined> {
      const food = await database.foods.get(id);
      return food !== undefined && isAlive(food) ? food : undefined;
    },

    /**
     * Incluye los borrados. Lo necesita la exportación, que tiene que propagar
     * las lápidas, y nada más.
     */
    async byIdIncludingDeleted(id: FoodId): Promise<Food | undefined> {
      return database.foods.get(id);
    },

    /** Búsqueda exacta por código de barras, la vía del escáner y del teclado. */
    async byBarcode(barcode: string): Promise<Food | undefined> {
      const matches = await database.foods.where('source.barcode').equals(barcode).toArray();
      return matches.find(isAlive);
    },

    /**
     * Búsqueda por texto dentro de lo ya conocido.
     *
     * Recorre la tabla y filtra por subcadena normalizada, en lugar de usar un
     * índice de prefijo. El motivo es que este catálogo solo contiene los
     * alimentos que esta persona ha consultado, así que son decenas o cientos de
     * filas, no millones, y un índice de prefijo no encontraría "Danone" dentro
     * de "Yogur natural Danone". Si algún día esta tabla creciera de verdad, la
     * vía es un índice de palabras y se registrará como decisión.
     */
    async searchByName(query: string, limit = 20): Promise<readonly Food[]> {
      const needle = normalizeForSearch(query);
      if (needle === '') {
        return [];
      }

      const found: Food[] = [];
      await database.foods.each((food) => {
        if (found.length >= limit || !isAlive(food)) {
          return;
        }
        const haystack = normalizeForSearch(`${food.name} ${food.brand ?? ''}`);
        if (haystack.includes(needle)) {
          found.push(food);
        }
      });

      return found;
    },

    /** Borrado lógico: escribe la lápida, no elimina la fila. */
    async remove(id: FoodId, at: Instant = now()): Promise<void> {
      const food = await database.foods.get(id);
      if (food === undefined) {
        return;
      }
      await database.foods.put(asDeleted(food, at));
    },

    /** Todo lo vivo. Pensado para diagnósticos y para el sembrado de ejemplo. */
    async all(): Promise<readonly Food[]> {
      const foods = await database.foods.toArray();
      return foods.filter(isAlive);
    },
  };
}

export const foodRepository = createFoodRepository(db);
