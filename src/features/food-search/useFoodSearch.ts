import { useQuery, type FetchStatus } from '@tanstack/react-query';

import { adoptSearchResults } from '@/features/food-search/adopt-results';
import { searchFoods, type FoodSearchPage } from '@/services/off';
import { isSearchable } from '@/shared/lib/text';
import { normalizeForSearch } from '@contracts/text';

/**
 * La búsqueda en Open Food Facts, con sus estados.
 *
 * Recibe una consulta **ya confirmada**, no lo que se está tecleando. Ese es el
 * cambio que trae D-041 y conviene entender por qué, porque desde aquí no se ve:
 * antes este hook recibía el texto pasado por un debounce de 400 ms, y medido,
 * teclear "leche entera" producía una petición si se tecleaba rápido y **nueve**
 * si se hacían pausas de más de 400 ms entre teclas. Cada prefijo (`lec`,
 * `lech`, `leche`…) es una clave de caché distinta en los tres sitios a la vez,
 * así que ninguna caché podía ayudar: no había nada repetido que cachear.
 *
 * El debounce no estaba roto —cancelaba correctamente—, era insuficiente por
 * construcción: cuando las pausas superan su umbral no hay nada que cancelar,
 * porque cada petición termina antes de que empiece la siguiente. Y Open Food
 * Facts avisa explícitamente en sus condiciones de que no se use su búsqueda
 * mientras se teclea, cosa que ya estaba anotada en el contexto de D-013.
 *
 * Así que quien teclea ve su catálogo local (`useLocalFoodSearch`) y aquí solo
 * se llega pulsando Intro o el botón. Sigue habiendo cancelación por
 * `AbortSignal`, que ahora cubre el caso de confirmar dos búsquedas seguidas.
 */

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
    // Hasta D-041 eso era mentira a medias, porque la normalización se aplicaba
    // solo aquí y la URL saliente llevaba el texto crudo; ahora `searchProducts`
    // normaliza también, que es donde de verdad cuenta.
    queryKey: ['off', 'search', normalizeForSearch(query)],
    // Los resultados pasan por el catálogo local antes de llegar a la pantalla.
    // Es D-013 aplicado ("todo alimento consultado se guarda en Dexie") y lo que
    // hace que cada tarjeta tenga un identificador que existe en disco, de modo
    // que añadir al diario sea un enlace y no un botón que escribe.
    queryFn: async ({ signal }) => adoptSearchResults(await searchFoods(query, { signal })),
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
