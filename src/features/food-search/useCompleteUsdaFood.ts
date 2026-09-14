import { useMutation, useQueryClient } from '@tanstack/react-query';

import { foodKeys, foodRepository } from '@/data/repositories/foods';
import type { Food } from '@/domain/food/food';
import { now } from '@/domain/time/local-date';
import { fetchUsdaFoodProfile } from '@/services/usda';
import { mergeUsdaDetailIntoCatalogFood } from '@/services/usda/complete';

/**
 * Completa un alimento de USDA con su panel de micronutrientes antes de
 * registrarlo, tal y como pide D-048.
 *
 * Un resultado de búsqueda de USDA nace sin micronutrientes: solo la ficha
 * detallada (`/api/usda/food/{fdcId}`) los trae. Guardar la instantánea de
 * D-003 directamente desde el resultado de búsqueda congelaría en el diario
 * un alimento con la mayoría de sus micronutrientes ausentes sin que nadie lo
 * hubiera decidido. Por eso "añadir al diario" un alimento de USDA no es un
 * enlace inmediato como en OFF (`AddToDiaryLink`): primero completa, y solo
 * si lo consigue navega.
 */
export type CompleteUsdaFoodResult =
  { readonly kind: 'completed'; readonly food: Food } | { readonly kind: 'unavailable' };

export function useCompleteUsdaFood() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (food: Food): Promise<CompleteUsdaFoodResult> => {
      // No es un `Food` de USDA, o ya se completó una vez (un `Food` que ya
      // trae algún micronutriente no necesita otra ficha). Se evita la
      // petición de red que ya no hace falta, no por probable sino porque
      // ocurre de verdad: la misma tarjeta del catálogo local se puede pulsar
      // después de haberla completado en una visita anterior.
      if (food.source.kind !== 'usda' || Object.keys(food.per100.micros).length > 0) {
        return { kind: 'completed', food };
      }

      const detail = await fetchUsdaFoodProfile(food.source.fdcId);
      if (detail.kind !== 'complete') {
        return { kind: 'unavailable' };
      }

      const merged = mergeUsdaDetailIntoCatalogFood(food, detail.food, now());
      await foodRepository.save(merged);
      return { kind: 'completed', food: merged };
    },
    onSuccess: async (result) => {
      if (result.kind === 'completed') {
        await client.invalidateQueries({ queryKey: foodKeys.byId(result.food.id) });
      }
    },
    networkMode: 'always',
  });
}
