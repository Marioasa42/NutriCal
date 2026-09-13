import { REFERENCE_AMOUNT, type NutrientProfile } from '@/domain/food/food';
import { buildMicronutrients } from '@/domain/nutrition/build-micronutrients';
import type { Macros } from '@/domain/nutrition/macros';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import { scale, type Quantity } from '@/domain/units/units';

/**
 * Escalado de un perfil nutricional a la cantidad que se comió.
 *
 * El perfil guardado siempre va por cien unidades base, sean gramos o
 * mililitros, así que todo esto es una multiplicación por `cantidad / 100`. Lo
 * que no es trivial es lo que hay que conservar por el camino:
 *
 * 1. Una clave ausente sigue ausente. Multiplicar un desconocido no lo convierte
 *    en un cero conocido (D-001).
 * 2. Un cero sigue siendo cero. El agua tiene cero calorías de verdad, y ese
 *    cero tiene que sobrevivir a cualquier cantidad.
 * 3. Cada magnitud conserva su marca. Escalar `Milligrams` da `Milligrams`.
 * 4. No se redondea. El redondeo es de presentación, y se aplica una sola vez
 *    sobre el número final (D-023).
 */

/**
 * El multiplicador que lleva del perfil por cien unidades a la cantidad real.
 *
 * `REFERENCE_AMOUNT` es la única fuente de ese cien: si algún día el perfil se
 * guardara por unidad, se cambia ahí y no en cada fórmula repartida.
 */
export function scalingFactor(amountInBaseUnit: Quantity): number {
  return amountInBaseUnit / REFERENCE_AMOUNT;
}

/**
 * Escala los macronutrientes.
 *
 * Las cuatro obligatorias se escalan siempre; las opcionales solo si la clave
 * está. Van escritas una a una a propósito: el compilador comprueba cada línea,
 * y el patrón `...(x !== undefined ? { k: ... } : {})` es lo que hace visible
 * que un dato que no teníamos sigue sin estar, en vez de aparecer como cero.
 */
export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    energy: scale(macros.energy, factor),
    protein: scale(macros.protein, factor),
    carbohydrates: scale(macros.carbohydrates, factor),
    fat: scale(macros.fat, factor),
    ...(macros.sugars !== undefined ? { sugars: scale(macros.sugars, factor) } : {}),
    ...(macros.saturatedFat !== undefined
      ? { saturatedFat: scale(macros.saturatedFat, factor) }
      : {}),
    ...(macros.fiber !== undefined ? { fiber: scale(macros.fiber, factor) } : {}),
    ...(macros.salt !== undefined ? { salt: scale(macros.salt, factor) } : {}),
  };
}

/**
 * Escala los micronutrientes.
 *
 * Delega en `buildMicronutrients` porque recorrer el catálogo con la clave como
 * variable es justo lo que hace perder al compilador la correlación entre clave
 * y unidad. La explicación completa, con el error literal que produce, está en
 * ese archivo.
 */
export function scaleMicros(micros: Micronutrients, factor: number): Micronutrients {
  return buildMicronutrients((id) => {
    const amount = micros[id];
    return amount === undefined ? undefined : scale(amount, factor);
  });
}

/** El perfil nutricional de una cantidad concreta, a partir del perfil por cien. */
export function scaleProfile(per100: NutrientProfile, amountInBaseUnit: Quantity): NutrientProfile {
  const factor = scalingFactor(amountInBaseUnit);
  return {
    macros: scaleMacros(per100.macros, factor),
    micros: scaleMicros(per100.micros, factor),
  };
}
