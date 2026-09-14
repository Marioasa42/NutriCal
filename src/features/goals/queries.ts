import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { goalsRepository } from '@/data/repositories/settings';
import type { DailyGoals } from '@/domain/goals/goals';
import type { LocalDate } from '@/domain/time/local-date';

/**
 * Las claves de los objetivos.
 *
 * `all` es el prefijo común a cualquier consulta de objetivos, y es el que se
 * invalida al guardar: una versión nueva puede cambiar qué es lo vigente para
 * CUALQUIER fecha ya en caché (una versión con `effectiveFrom` de hoy también
 * es la vigente para dentro de un mes), así que invalidar solo la fecha que se
 * estaba editando dejaría cachés de otras fechas con una respuesta obsoleta.
 */
export const goalsKeys = {
  all: ['db', 'goals'] as const,
  effectiveOn: (date: LocalDate) => ['db', 'goals', 'effectiveOn', date] as const,
};

const LOCAL = { networkMode: 'always' } as const;

/** Los objetivos vigentes en una fecha. `undefined` si todavía no se ha fijado ninguno. */
export function useGoalsQuery(date: LocalDate) {
  return useQuery({
    queryKey: goalsKeys.effectiveOn(date),
    queryFn: () => goalsRepository.effectiveOn(date),
    ...LOCAL,
  });
}

/**
 * Guarda una nueva versión de los objetivos.
 *
 * No hay una operación de "editar": según D-004, cada cambio es una fila nueva
 * con su propio `effectiveFrom`. Quien llama decide el identificador y las
 * fechas; esta mutación solo escribe y refresca la caché.
 */
export function useSaveGoals() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (goals: DailyGoals) => goalsRepository.save(goals),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: goalsKeys.all });
    },
    ...LOCAL,
  });
}
