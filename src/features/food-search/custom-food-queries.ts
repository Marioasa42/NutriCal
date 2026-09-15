import { useMutation, useQueryClient } from '@tanstack/react-query';

import { foodKeys, foodRepository } from '@/data/repositories/foods';
import type { FoodId } from '@/domain/identity/ids';

/**
 * Borrar y deshacer un alimento propio, con el mismo patrón que
 * `useRemoveMeal`/`useRestoreMeal` de `features/diary/queries.ts` (D-042):
 * lápida, no fila eliminada, e invalidación de las dos claves que pueden
 * tener una copia en caché.
 *
 * No se reutilizan esos hooks porque viven en `features/diary/`, y D-027
 * prohíbe que una funcionalidad importe de otra: se repite el patrón, no el
 * código.
 *
 * `localFoodKeys.search(...)` está indexado por el texto tecleado, así que
 * invalidar la clave exacta no basta -podría haber varias entradas en caché,
 * una por cada texto ya buscado en esta visita-. `client.invalidateQueries`
 * hace coincidencia por prefijo: pasar solo `['db', 'foods', 'search']`
 * invalida todas a la vez.
 */
const LOCAL = { networkMode: 'always' } as const;

export function useRemoveCustomFood() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: FoodId) => foodRepository.remove(id),
    onSuccess: async (_result, id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['db', 'foods', 'search'] }),
        client.invalidateQueries({ queryKey: foodKeys.byId(id) }),
      ]);
    },
    ...LOCAL,
  });
}

export function useRestoreCustomFood() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: FoodId) => foodRepository.restore(id),
    onSuccess: async (_result, id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['db', 'foods', 'search'] }),
        client.invalidateQueries({ queryKey: foodKeys.byId(id) }),
      ]);
    },
    ...LOCAL,
  });
}
