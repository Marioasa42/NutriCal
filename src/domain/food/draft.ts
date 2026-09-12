import type { BaseUnit, Food, FoodSource, ServingOption } from '@/domain/food/food';
import type { Macros, RequiredMacroKey } from '@/domain/nutrition/macros';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import type { Quantity } from '@/domain/units/units';

/**
 * Un producto que existe y se ha encontrado, pero al que le faltan macros del
 * núcleo y por tanto todavía no es un `Food` válido.
 *
 * `Partial<Macros>` es un tipo derivado: convierte en opcionales todas las claves
 * de `Macros` sin tocar la definición original. `Macros` sigue siendo estricto
 * para el resto de la aplicación.
 */
export interface FoodDraft {
  readonly name: string;
  readonly brand?: string;
  readonly source: FoodSource;
  readonly baseUnit: BaseUnit;
  readonly macros: Partial<Macros>;
  readonly micros: Micronutrients;
  readonly servings: readonly ServingOption<Quantity>[];
  /** Qué campos obligatorios hay que pedirle a la persona usuaria. */
  readonly missing: readonly RequiredMacroKey[];
}

/**
 * Resultado de normalizar una respuesta externa.
 *
 * Nunca lanza una excepción. Un código de barras válido cuyo producto está
 * incompleto no es un error: es un caso de uso. La rama `needsCompletion` lleva
 * a un formulario donde se rellenan los huecos, y lo que se rellene queda
 * marcado en `NutrientCompletion` para poder mostrarlo como estimación.
 */
export type NormalizationResult =
  | { readonly kind: 'complete'; readonly food: Food }
  | { readonly kind: 'needsCompletion'; readonly draft: FoodDraft };
