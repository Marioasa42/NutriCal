import { useQuery, type FetchStatus } from '@tanstack/react-query';

import { adoptUsdaSearchResults } from '@/features/food-search/adopt-results';
import { searchUsdaCatalog, type UsdaSearchPage } from '@/services/usda';
import { translateSearchTerm } from '@/services/usda/food-terms';
import { isSearchable } from '@/shared/lib/text';
import { normalizeForSearch } from '@contracts/text';

/**
 * La búsqueda en USDA FoodData Central, con sus estados.
 *
 * Calcado de `useFoodSearch.ts` (OFF) y no generalizado en un solo hook: las
 * dos fuentes comparten la forma del problema, no el tipo de dato que
 * devuelven (`FoodSearchPage` frente a `UsdaSearchPage`), y es la misma razón
 * por la que `services/usda/` es un árbol de archivos propio en vez de
 * parametrizar `services/off/` (D-047, D-048). Recibe una consulta ya
 * confirmada, nunca lo que se está tecleando, por el mismo motivo que D-041
 * documentó para OFF: mientras se teclea se busca en el catálogo local
 * (`useLocalFoodSearch`), y a la fuente se sale solo con Intro o el botón.
 */

export type UsdaSearchViewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'empty'; readonly query: string }
  | { readonly kind: 'results'; readonly page: UsdaSearchPage };

/** Lo mínimo que hace falta del resultado de la consulta, para poder probarlo sin React. */
export interface UsdaSearchQuerySnapshot {
  readonly enabled: boolean;
  readonly fetchStatus: FetchStatus;
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: UsdaSearchPage | undefined;
  readonly query: string;
}

export function toUsdaSearchViewState(snapshot: UsdaSearchQuerySnapshot): UsdaSearchViewState {
  if (!snapshot.enabled) {
    return { kind: 'idle' };
  }
  if (snapshot.isError) {
    return { kind: 'error', error: snapshot.error };
  }
  if (snapshot.fetchStatus === 'paused') {
    return { kind: 'offline' };
  }
  if (snapshot.data === undefined) {
    return { kind: 'loading' };
  }
  if (snapshot.data.foods.length === 0 && snapshot.data.drafts.length === 0) {
    return { kind: 'empty', query: snapshot.query };
  }
  return { kind: 'results', page: snapshot.data };
}

export interface UsdaFoodSearchResult {
  readonly state: UsdaSearchViewState;
  readonly retry: () => void;
  readonly isRefreshing: boolean;
  /**
   * El término que de verdad ha salido hacia USDA, después de pasar por el
   * glosario de `food-terms.ts` si lo conocía. Se expone siempre, no solo
   * cuando hay traducción: mostrar el término real solo a veces daría a
   * entender que las otras veces se buscó justo lo escrito, y no siempre es
   * cierto.
   */
  readonly searchedAs: string;
}

export function useUsdaFoodSearch(query: string): UsdaFoodSearchResult {
  const enabled = isSearchable(query);
  // El glosario traduce ANTES de construir la clave de caché y la URL: si se
  // tradujera después, "manzana" y "apple" seguirían siendo dos entradas de
  // caché distintas para el mismo resultado, la misma trampa que D-041
  // documentó para las variantes de acentuación de OFF.
  const searchedAs = translateSearchTerm(query);

  const result = useQuery({
    queryKey: ['usda', 'search', normalizeForSearch(searchedAs)],
    queryFn: async ({ signal }) =>
      adoptUsdaSearchResults(await searchUsdaCatalog(searchedAs, { signal })),
    enabled,
  });

  return {
    state: toUsdaSearchViewState({
      enabled,
      fetchStatus: result.fetchStatus,
      isError: result.isError,
      error: result.error,
      data: result.data,
      query: searchedAs,
    }),
    retry: () => {
      void result.refetch();
    },
    isRefreshing: result.data !== undefined && result.fetchStatus === 'fetching',
    searchedAs,
  };
}
