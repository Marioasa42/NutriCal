import { isSearchable } from '@/shared/lib/text';
import { fetchProduct, searchProducts, type RequestOptions } from '@/services/off/client';
import {
  defaultNormalizationContext,
  normalizeProduct,
  normalizeProducts,
  type NormalizationContext,
  type NormalizedProducts,
  type ProductNormalization,
} from '@/services/off/normalize';

/**
 * La cara pública del servicio: red y normalización juntas.
 *
 * Las dos mitades viven en archivos separados y se prueban por separado, porque
 * son problemas distintos. `client.ts` sabe de HTTP y no sabe qué es una macro;
 * `normalize.ts` es código puro que no sabe que existe la red. Este archivo es lo
 * único que las conoce a las dos, y es deliberadamente fino.
 */

export {
  OffApiError,
  type OffErrorCode,
  type RequestOptions,
  fetchProduct,
  searchProducts,
} from '@/services/off/client';
export {
  normalizeProduct,
  normalizeProducts,
  type NormalizationContext,
  type NormalizedProducts,
  type ProductNormalization,
} from '@/services/off/normalize';

export interface FoodSearchPage extends NormalizedProducts {
  readonly query: string;
  readonly page: number;
  /** Cuántos resultados dice la fuente que hay en total, no cuántos vienen. */
  readonly total: number;
}

const EMPTY_PAGE = (query: string): FoodSearchPage => ({
  query,
  page: 1,
  total: 0,
  foods: [],
  drafts: [],
  unreadable: 0,
});

/**
 * Busca alimentos por texto y los deja listos para el dominio.
 *
 * Una consulta demasiado corta ni sale a la red. No es una optimización: las
 * condiciones de uso de Open Food Facts limitan la búsqueda a diez peticiones por
 * minuto y por dirección IP, y en Vercel esa dirección la compartimos con otros,
 * así que cada petición que no hace falta es una que le quitamos a alguien. El
 * mínimo se lee de `shared/lib/text` para que sea el mismo número que usa la
 * interfaz al decidir si tiene sentido buscar.
 */
export async function searchFoods(
  query: string,
  options: RequestOptions & { page?: number; context?: NormalizationContext } = {},
): Promise<FoodSearchPage> {
  if (!isSearchable(query)) {
    return EMPTY_PAGE(query);
  }

  const payload = await searchProducts(query, options);
  const normalized = normalizeProducts(
    payload.products,
    options.context ?? defaultNormalizationContext,
  );

  return {
    query: payload.query,
    page: payload.page,
    total: payload.count,
    ...normalized,
  };
}

/**
 * Resultado de buscar un código de barras concreto.
 *
 * `notFound` es una cuarta rama, distinta de `unreadable`: un código que la
 * fuente no conoce no es lo mismo que un producto que la fuente devuelve roto. La
 * interfaz responde distinto a cada uno, con "no lo encontramos, créalo a mano"
 * frente a "lo encontramos pero no lo entendemos".
 */
export type BarcodeLookup = ProductNormalization | { readonly kind: 'notFound' };

export async function findFoodByBarcode(
  barcode: string,
  options: RequestOptions & { context?: NormalizationContext } = {},
): Promise<BarcodeLookup> {
  const payload = await fetchProduct(barcode, options);
  if (payload.product === null || payload.product === undefined) {
    return { kind: 'notFound' };
  }
  return normalizeProduct(payload.product, options.context ?? defaultNormalizationContext);
}
