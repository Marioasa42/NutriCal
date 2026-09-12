import type { FoodId, ServingId } from '@/domain/identity/ids';
import type { Macros, MacroKey } from '@/domain/nutrition/macros';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import type { Persisted } from '@/domain/persistence/persisted';
import type { Instant } from '@/domain/time/local-date';
import type { Grams, Milliliters, Quantity } from '@/domain/units/units';

/** Un alimento se mide en masa o en volumen. No hay una tercera opción prevista. */
export type BaseUnit = 'g' | 'ml';

/**
 * De dónde salió el registro, como unión discriminada.
 *
 * Una unión discriminada es un conjunto de formas alternativas que comparten un
 * campo literal, aquí `kind`. Al comprobar ese campo, TypeScript sabe qué otros
 * campos existen: dentro de un `if (source.kind === 'openFoodFacts')` puedes leer
 * `source.barcode`, y fuera no.
 */
export type FoodSource =
  | { readonly kind: 'openFoodFacts'; readonly barcode: string; readonly fetchedAt: Instant }
  | { readonly kind: 'usda'; readonly fdcId: number; readonly fetchedAt: Instant }
  | { readonly kind: 'custom' };

/** Perfil nutricional de una cantidad de referencia. */
export interface NutrientProfile {
  readonly macros: Macros;
  readonly micros: Micronutrients;
}

/**
 * Una forma de servir el alimento: una rebanada, un vaso, un puñado.
 *
 * Es genérico en la cantidad para poder atarlo a la unidad base del alimento.
 * `ServingOption<Grams>` no encaja donde se espera `ServingOption<Milliliters>`.
 */
export interface ServingOption<Q extends Quantity> {
  readonly id: ServingId;
  readonly label: string;
  readonly amountInBaseUnit: Q;
}

/** Qué cifras no venían de la fuente y puso a mano la persona usuaria. */
export interface NutrientCompletion {
  readonly userFilled: readonly MacroKey[];
  readonly completedAt?: Instant;
}

/** Nada de esto depende de si el alimento se mide en masa o en volumen. */
interface FoodBase extends Persisted {
  readonly id: FoodId;
  readonly name: string;
  readonly brand?: string;
  readonly source: FoodSource;
  /** Siempre por 100 unidades base: por 100 g o por 100 ml. */
  readonly per100: NutrientProfile;
  readonly completion: NutrientCompletion;
}

export interface MassFood extends FoodBase {
  readonly baseUnit: 'g';
  readonly servings: readonly ServingOption<Grams>[];
}

export interface VolumeFood extends FoodBase {
  readonly baseUnit: 'ml';
  readonly servings: readonly ServingOption<Milliliters>[];
}

/**
 * Un alimento es una cosa o la otra, nunca una mezcla. Esto es lo que impide
 * construir un alimento con unidad base en mililitros y porciones en gramos.
 */
export type Food = MassFood | VolumeFood;

/** La cantidad de referencia del perfil nutricional: siempre cien unidades base. */
export const REFERENCE_AMOUNT = 100;

/** Un dato concreto lo introdujo la persona usuaria, no la fuente. */
export const isUserFilled = (food: Pick<Food, 'completion'>, key: MacroKey): boolean =>
  food.completion.userFilled.includes(key);
