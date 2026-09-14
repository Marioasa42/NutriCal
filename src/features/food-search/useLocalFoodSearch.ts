import { useQuery } from '@tanstack/react-query';

import { foodRepository } from '@/data/repositories/foods';
import type { Food } from '@/domain/food/food';
import { isSearchable } from '@/shared/lib/text';
import { normalizeForSearch } from '@contracts/text';

/**
 * Buscar dentro del catálogo que ya tienes, mientras tecleas.
 *
 * Esta es la mitad de D-013 que nunca se implementó: `searchByName` existía
 * desde el paso 1, con sus diez tests, y no lo llamaba nadie más que sus propios
 * tests. Escribíamos el caché en cada búsqueda y luego no lo leíamos.
 *
 * Aquí **no hay debounce**, y es a propósito. El debounce existe para no gastar
 * peticiones de red que no hacen falta; leer IndexedDB no gasta ninguna, así que
 * retrasar esto solo conseguiría que la pantalla fuera más lenta sin ahorrar
 * nada. Es la diferencia entera que introduce D-041: lo que cuesta se pide con
 * intención, y lo que no cuesta se enseña al instante.
 *
 * La clave empieza por `db` igual que las del diario, para que se distinga de un
 * vistazo de las de `off`, que son las que sí salen a la red. No se reutiliza
 * `dbKeys` de `features/diary/` porque eso ataría esta funcionalidad a la otra,
 * que es justo la dirección de dependencias que D-027 evita.
 */
export const localFoodKeys = {
  search: (needle: string) => ['db', 'foods', 'search', needle] as const,
};

/** `networkMode: 'always'` por lo mismo que en el diario: esto es disco, no red. */
const LOCAL = { networkMode: 'always' } as const;

export interface LocalFoodSearchResult {
  /** Los alimentos del catálogo que casan con lo tecleado. */
  readonly foods: readonly Food[];
  /** Hay texto suficiente para haber buscado algo. */
  readonly searched: boolean;
  readonly isPending: boolean;
}

export function useLocalFoodSearch(text: string): LocalFoodSearchResult {
  const needle = normalizeForSearch(text);
  const enabled = isSearchable(text);

  const { data, isPending } = useQuery({
    queryKey: localFoodKeys.search(needle),
    queryFn: () => foodRepository.searchByName(needle),
    enabled,
    ...LOCAL,
  });

  return {
    foods: data ?? [],
    searched: enabled,
    // Con la consulta apagada, TanStack Query se queda en `pending` para
    // siempre. Sin esta comprobación, no teclear nada se vería como "cargando"
    // eterno: es la misma trampa que documenta `toSearchViewState`.
    isPending: enabled && isPending,
  };
}
