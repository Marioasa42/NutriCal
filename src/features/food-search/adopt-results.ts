import { foodRepository } from '@/data/repositories/foods';
import type { Food } from '@/domain/food/food';
import type { BarcodeLookup, FoodSearchPage } from '@/services/off';
import type { UsdaSearchPage } from '@/services/usda';

/**
 * Guardar en el catálogo local lo que acaba de traer la búsqueda.
 *
 * No es una optimización: es la mitad que faltaba de D-013, que dice que todo
 * alimento consultado se guarda en Dexie. Y es lo que permite que la tarjeta de
 * un resultado sea un enlace a `/dia/:date/registrar/:foodId` en vez de un botón
 * que primero escriba y luego navegue. La diferencia importa más de lo que
 * parece: con un enlace, la pantalla que registra solo necesita un
 * identificador, se puede recargar y compartir, y la funcionalidad de búsqueda
 * no tiene que importar nada de la del diario (D-027).
 *
 * `adopt` devuelve el alimento que hay que usar: si ese código de barras (o,
 * desde D-048, ese `fdcId` de USDA) ya estaba en el catálogo, devuelve el
 * guardado y no lo pisa, porque la copia guardada puede llevar cifras
 * completadas a mano, o el panel de micronutrientes ya completado, y la recién
 * traída nunca los lleva. Por eso hay que quedarse con lo que devuelve y no con
 * lo que se le pasó: el identificador del enlace tiene que ser el que existe en
 * disco.
 *
 * Si escribir falla, se devuelve la página tal cual. Es deliberado: una búsqueda
 * que ha ido bien no debe convertirse en un error en pantalla porque el
 * almacenamiento local no esté disponible, cosa que pasa en algunos modos de
 * navegación privada. Se degrada a que el enlace de añadir no encuentre el
 * alimento, que la pantalla de destino ya sabe explicar, en lugar de tirar los
 * resultados que sí tenemos.
 */
async function adoptFoods<TPage extends { readonly foods: readonly Food[] }>(
  page: TPage,
): Promise<TPage> {
  try {
    const foods = await Promise.all(page.foods.map((food) => foodRepository.adopt(food)));
    return { ...page, foods };
  } catch {
    return page;
  }
}

export const adoptSearchResults = (page: FoodSearchPage): Promise<FoodSearchPage> =>
  adoptFoods(page);

/** Lo mismo para una página de resultados de USDA (D-048). */
export const adoptUsdaSearchResults = (page: UsdaSearchPage): Promise<UsdaSearchPage> =>
  adoptFoods(page);

/** Lo mismo para la resolución de un código de barras, que trae un alimento o ninguno. */
export async function adoptLookup(lookup: BarcodeLookup): Promise<BarcodeLookup> {
  if (lookup.kind !== 'complete') {
    return lookup;
  }
  try {
    const food: Food = await foodRepository.adopt(lookup.food);
    return { kind: 'complete', food };
  } catch {
    return lookup;
  }
}
