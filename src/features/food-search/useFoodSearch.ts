import { useQuery, type FetchStatus } from '@tanstack/react-query';

import { searchFoods, type FoodSearchPage } from '@/services/off';
import { isSearchable, normalizeForSearch } from '@/shared/lib/text';

/**
 * La búsqueda de alimentos, con sus estados.
 *
 * Lo único que hace falta cancelar a mano es nada: TanStack Query pasa un
 * `AbortSignal` a la función de consulta y aborta la petición en vuelo cuando la
 * consulta se queda sin observadores, que es exactamente lo que pasa al cambiar
 * la clave de caché porque el texto ha cambiado. El cliente ya acepta ese
 * `signal` desde el paso 2b y deja subir el `AbortError` sin envolverlo, para que
 * cancelar no se confunda con fallar.
 */

/** Cuánto se espera desde la última tecla antes de salir a la red. */
export const SEARCH_DEBOUNCE_MS = 400;

/**
 * Los estados que la pantalla sabe dibujar, como unión discriminada.
 *
 * Se declara aparte, y se calcula con una función pura, por el motivo que hace
 * que este trozo sea el que más se equivoca: en TanStack Query v5 una consulta
 * apagada con `enabled: false` se queda en `status: 'pending'` para siempre. Si
 * el "cargando" se dibujara mirando solo `isPending`, con menos de tres
 * caracteres se vería un indicador de carga eterno para una petición que nunca
 * se hizo. Hay que mirar también `fetchStatus`, que es un eje distinto: `status`
 * dice qué datos hay, `fetchStatus` dice si ahora mismo se está pidiendo algo.
 */
export type SearchViewState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'empty'; readonly query: string }
  | { readonly kind: 'results'; readonly page: FoodSearchPage };

/** Lo mínimo que hace falta del resultado de la consulta, para poder probarlo sin React. */
export interface SearchQuerySnapshot {
  readonly enabled: boolean;
  readonly fetchStatus: FetchStatus;
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: FoodSearchPage | undefined;
  readonly query: string;
}

export function toSearchViewState(snapshot: SearchQuerySnapshot): SearchViewState {
  if (!snapshot.enabled) {
    return { kind: 'idle' };
  }
  if (snapshot.isError) {
    return { kind: 'error', error: snapshot.error };
  }

  // `paused` es la respuesta de TanStack Query a estar sin conexión: con el modo
  // de red por defecto, la petición no se intenta siquiera y la consulta queda
  // esperando. No es un error, es una espera, y se reanuda sola al volver la red.
  // Distinguirlo importa porque la acción que espera de quien lee es distinta:
  // aquí no hay nada que reintentar, solo que recuperar la conexión.
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

export interface FoodSearchResult {
  readonly state: SearchViewState;
  readonly retry: () => void;
  /** Hay datos en pantalla y a la vez se está pidiendo algo: para un indicador discreto. */
  readonly isRefreshing: boolean;
}

export function useFoodSearch(query: string): FoodSearchResult {
  const enabled = isSearchable(query);

  const result = useQuery({
    // La clave usa el texto normalizado, no el que se tecleó. Así "Plátano" y
    // "platano" comparten entrada de caché, que es la misma clave con la que la
    // función serverless guarda su respuesta: las dos cachés aciertan a la vez.
    queryKey: ['off', 'search', normalizeForSearch(query)],
    queryFn: ({ signal }) => searchFoods(query, { signal }),
    enabled,
  });

  return {
    state: toSearchViewState({
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
