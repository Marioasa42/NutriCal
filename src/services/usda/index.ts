import { isSearchable } from '@/shared/lib/text';
import { fetchUsdaFood, searchUsdaFoods, type RequestOptions } from '@/services/usda/client';
import {
  defaultNormalizationContext,
  normalizeFoodDetail,
  normalizeSearchFoods,
  type NormalizationContext,
  type NormalizedUsdaFoods,
  type UsdaNormalization,
} from '@/services/usda/normalize';

/**
 * La cara pública del servicio: red y normalización juntas.
 *
 * Mismo reparto que `services/off/index.ts`: este archivo es el único que
 * conoce a la vez `client.ts` (HTTP) y `normalize.ts` (dominio puro), y es
 * deliberadamente fino.
 */

export {
  UsdaApiError,
  type RequestOptions,
  type UsdaErrorCode,
  fetchUsdaFood,
  searchUsdaFoods,
} from '@/services/usda/client';
export {
  normalizeFoodDetail,
  normalizeSearchFood,
  normalizeSearchFoods,
  type NormalizationContext,
  type NormalizedUsdaFoods,
  type UsdaNormalization,
} from '@/services/usda/normalize';

export interface UsdaSearchPage extends NormalizedUsdaFoods {
  readonly query: string;
}

const EMPTY_PAGE = (query: string): UsdaSearchPage => ({
  query,
  foods: [],
  drafts: [],
  unreadable: 0,
});

/**
 * Busca alimentos por texto en USDA y los deja listos para el dominio.
 *
 * Los alimentos que devuelve NO llevan el panel de micronutrientes completo
 * (D-048): la búsqueda de FDC no lo trae. Quien enseñe estos resultados tiene
 * que decir que los micronutrientes se completan al añadir, y quien registre
 * uno en el diario tiene que pasar antes por `fetchUsdaFoodProfile`.
 */
export async function searchUsdaCatalog(
  query: string,
  options: RequestOptions & { context?: NormalizationContext } = {},
): Promise<UsdaSearchPage> {
  if (!isSearchable(query)) {
    return EMPTY_PAGE(query);
  }

  const payload = await searchUsdaFoods(query, options);
  const normalized = normalizeSearchFoods(
    payload.foods,
    options.context ?? defaultNormalizationContext,
  );

  return { query: payload.query, ...normalized };
}

/**
 * La ficha completa de un alimento, ya normalizada con el panel de
 * micronutrientes.
 *
 * Es el paso que la decisión (c) de la fase 2 exige antes de poder registrar
 * un alimento de USDA en el diario. No hay una rama "no encontrado" propia:
 * un `fdcId` que ha salido de una búsqueda nuestra existía en FDC hace un
 * instante, y si aun así ya no lo conoce, se trata igual que cualquier
 * respuesta ilegible, porque para quien consulta es el mismo problema
 * ("no se puede completar este alimento ahora mismo").
 */
export async function fetchUsdaFoodProfile(
  fdcId: number,
  options: RequestOptions & { context?: NormalizationContext } = {},
): Promise<UsdaNormalization> {
  const payload = await fetchUsdaFood(fdcId, options);
  if (payload.food === null || payload.food === undefined) {
    return { kind: 'unreadable', reason: 'USDA FoodData Central ya no conoce este alimento.' };
  }
  return normalizeFoodDetail(payload.food, options.context ?? defaultNormalizationContext);
}
