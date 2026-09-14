import { useQuery, type FetchStatus } from '@tanstack/react-query';

import { adoptUsdaSearchResults } from '@/features/food-search/adopt-results';
import { searchUsdaCatalog, type UsdaSearchPage } from '@/services/usda';
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
}

export function useUsdaFoodSearch(query: string): UsdaFoodSearchResult {
  const enabled = isSearchable(query);

  const result = useQuery({
    // La clave usa el texto normalizado, por el mismo motivo de caché que
    // documenta `client.ts`: es la URL con la que la red de distribución de
    // Vercel guarda la respuesta de `/api/usda/search`.
    queryKey: ['usda', 'search', normalizeForSearch(query)],
    queryFn: async ({ signal }) =>
      adoptUsdaSearchResults(await searchUsdaCatalog(query, { signal })),
    enabled,
  });

  return {
    state: toUsdaSearchViewState({
      enabled,
      fetchStatus: result.fetchStatus,
      isError: result.isError,
      error: result.error,
      data: result.data,
      query,
    }),
    retry: () => {
      void result.refetch();
    },
    isRefreshing: result.data !== undefined && result.fetchStatus === 'fetching',
  };
}
