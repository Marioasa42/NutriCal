import { newFoodId, newServingId, type FoodId, type ServingId } from '@/domain/identity/ids';
import { now, type Instant } from '@/domain/time/local-date';

/**
 * Las dependencias impuras de cualquier normalizador de una fuente externa,
 * por parámetro.
 *
 * Sin esto, normalizar un producto leería el reloj y generaría identificadores
 * por dentro, y dos llamadas con la misma entrada darían objetos distintos:
 * ningún test podría comparar el resultado completo. Con el contexto
 * inyectado, la normalización vuelve a ser una función pura de sus argumentos.
 *
 * Vivía dentro de `services/off/normalize.ts`, y se muda aquí por el mismo
 * motivo que `shared/api-error.ts`: a partir de USDA (fase 2) hay una segunda
 * fuente que necesita exactamente lo mismo. No es un concepto de Open Food
 * Facts, es un concepto de "convertir la respuesta de una fuente externa en
 * una entidad del dominio".
 */
export interface NormalizationContext {
  readonly now: () => Instant;
  readonly newFoodId: () => FoodId;
  readonly newServingId: () => ServingId;
}

export const defaultNormalizationContext: NormalizationContext = {
  now,
  newFoodId,
  newServingId,
};
