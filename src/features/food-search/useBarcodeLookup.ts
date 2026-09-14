import { useQuery, type FetchStatus } from '@tanstack/react-query';

import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import { adoptLookup } from '@/features/food-search/adopt-results';
import { findFoodByBarcode, type BarcodeLookup } from '@/services/off';
import { isValidBarcode } from '@contracts/barcode';

/**
 * Resolver un código de barras concreto.
 *
 * Hermano de `useFoodSearch` y con la misma forma a propósito: una unión
 * discriminada calculada por una función pura, para que la pantalla solo tenga
 * que hacer un `switch`. Lo que cambia son las ramas, porque las respuestas
 * posibles no son las mismas.
 */

/**
 * Las ramas. Las tres últimas son las que distinguen esto de una búsqueda.
 *
 * `notFound` y `unreadable` van separadas porque `services/off` ya las separa
 * desde el paso 2b: un código que la fuente no conoce no es lo mismo que un
 * producto que la fuente devuelve roto. "No lo tenemos" y "lo tenemos pero no lo
 * entendemos" llevan a sitios distintos, y esta pantalla es la primera que
 * cobra esa distinción.
 */
export type BarcodeViewState =
  | { readonly kind: 'invalid'; readonly barcode: string }
  | { readonly kind: 'loading' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'error'; readonly error: unknown }
  | { readonly kind: 'notFound'; readonly barcode: string }
  | { readonly kind: 'unreadable'; readonly reason: string }
  | { readonly kind: 'complete'; readonly food: Food }
  | { readonly kind: 'needsCompletion'; readonly draft: FoodDraft };

export interface BarcodeQuerySnapshot {
  readonly barcode: string;
  readonly fetchStatus: FetchStatus;
  readonly isError: boolean;
  readonly error: unknown;
  readonly data: BarcodeLookup | undefined;
}

export function toBarcodeViewState(snapshot: BarcodeQuerySnapshot): BarcodeViewState {
  // La validación local va antes que todo lo demás: es la que evita gastar una
  // petición en algo que el servidor va a rechazar con la misma regla.
  if (!isValidBarcode(snapshot.barcode)) {
    return { kind: 'invalid', barcode: snapshot.barcode };
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

  // Las tres ramas que ya venían decididas de `services/off`. El `switch` sobre
  // el campo discriminante deja que el linter avise si algún día aparece una
  // cuarta, en vez de dejarla caer en un caso por defecto.
  switch (snapshot.data.kind) {
    case 'notFound':
      return { kind: 'notFound', barcode: snapshot.barcode };
    case 'unreadable':
      return { kind: 'unreadable', reason: snapshot.data.reason };
    case 'complete':
      return { kind: 'complete', food: snapshot.data.food };
    case 'needsCompletion':
      return { kind: 'needsCompletion', draft: snapshot.data.draft };
  }
}

export interface BarcodeLookupResult {
  readonly state: BarcodeViewState;
  readonly retry: () => void;
}

export function useBarcodeLookup(barcode: string): BarcodeLookupResult {
  const enabled = isValidBarcode(barcode);

  const result = useQuery({
    queryKey: ['off', 'product', barcode],
    // Igual que en la búsqueda: lo que llega pasa por el catálogo local, así el
    // alimento encontrado ya tiene un identificador con el que enlazar (D-013).
    queryFn: async ({ signal }) => adoptLookup(await findFoodByBarcode(barcode, { signal })),
    enabled,
  });

  return {
    state: toBarcodeViewState({
      barcode,
      fetchStatus: result.fetchStatus,
      isError: result.isError,
      error: result.error,
      data: result.data,
    }),
    retry: () => {
      void result.refetch();
    },
  };
}
