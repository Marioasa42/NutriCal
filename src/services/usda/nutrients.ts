import { micrograms, milligrams } from '@/domain/units/units';
import type { MicronutrientAmount } from '@/domain/nutrition/build-micronutrients';
import { unitOf, type MicronutrientId } from '@/domain/nutrition/micronutrients';

/**
 * Correspondencia entre el "número de nutriente" de FDC y nuestro catálogo.
 *
 * El número de nutriente (`203`, `303`…) es la clave estable de FDC: es la
 * misma para cualquier alimento y para cualquier formato de respuesta, a
 * diferencia del `id` interno de cada fila, que es propio de una ficha
 * concreta y no sirve para identificar de qué nutriente se habla en otra. Se
 * verificó contra datos reales devueltos por la API (ficha de lentejas crudas,
 * SR Legacy, y varios alimentos de marca), no copiado de una tabla de
 * documentación: la documentación pública de FDC no publica esta
 * correspondencia completa ni de forma consistente entre sus propios
 * materiales.
 *
 * El yodo no aparece a propósito. FDC lo alimenta desde una base de
 * colaboración NIH/FDA/USDA aparte del panel nutricional habitual, la inmensa
 * mayoría de alimentos de una búsqueda no lo declaran, y no hay un número de
 * nutriente único y fiable para él en el panel que trae una búsqueda o una
 * ficha normales. Pedirlo iría contra D-001: representar un dato inventado
 * como si fuera un dato real. Un alimento de fuente USDA deja el yodo siempre
 * ausente (desconocido), y quien lo necesite lo teclea a mano.
 */
export const FDC_NUTRIENT_NUMBERS: Partial<Record<MicronutrientId, string>> = {
  vitaminA: '320',
  vitaminC: '401',
  vitaminD: '328',
  vitaminE: '323',
  vitaminK: '430',
  thiamin: '404',
  riboflavin: '405',
  niacin: '406',
  vitaminB6: '415',
  folate: '435',
  vitaminB12: '418',
  calcium: '301',
  iron: '303',
  magnesium: '304',
  phosphorus: '305',
  potassium: '306',
  sodium: '307',
  zinc: '309',
  copper: '312',
  selenium: '317',
  manganese: '315',
};

/**
 * Los números de FDC para las cuatro macros obligatorias.
 *
 * `208` es la energía en kilocalorías, no en kilojulios: FDC declara la unidad
 * en `unitName` (`"KCAL"`), y `readFdcMacro` de `normalize.ts` la respeta en
 * vez de asumirla, por el mismo motivo que `readEnergyKcal` de OFF no asume
 * que un número suelto sea kilocalorías.
 */
export const FDC_MACRO_NUMBERS = {
  energy: '208',
  protein: '203',
  carbohydrates: '205',
  fat: '204',
} as const;

/**
 * Las macros opcionales que sabemos leer de FDC.
 *
 * `salt` (la sal del envase, en gramos) no está aquí y es una omisión
 * deliberada, no un olvido: FDC no publica sal, publica sodio (nutriente
 * `307`, en miligramos), y pasar de uno a otro exige multiplicar por un factor
 * de conversión (approx. 2,5) que nadie ha medido para ese alimento concreto.
 * Inventar la sal a partir del sodio sería exactamente lo que D-001 prohíbe:
 * presentar una estimación con el aspecto de un dato de la fuente. El sodio en
 * sí no se pierde: se guarda tal cual en `Micronutrients.sodium`, en
 * miligramos, como cualquier otro micronutriente de la tabla.
 */
export const FDC_OPTIONAL_MACRO_NUMBERS = {
  sugars: '269',
  saturatedFat: '606',
  fiber: '291',
} as const;

/**
 * Busca un valor por su número de nutriente FDC en una lista, sin decidir
 * todavía cómo se llaman los campos del nutriente: eso lo dicen los dos
 * lectores de abajo, uno por cada forma real de la API.
 *
 * Ausente en la lista, o presente con un valor que no es una medida (negativo,
 * no finito), son dos hechos que aquí se tratan igual a propósito:
 * desconocido, nunca cero (D-001). El resultado se usa tal cual en las macros
 * y se envuelve en `microAmountFor` para los micronutrientes, porque las
 * macros no llevan la unidad en el tipo (siempre gramos o kilocalorías) y los
 * micronutrientes sí.
 */
function makeAmountFinder<TNutrient>(
  numberOf: (nutrient: TNutrient) => string | number | null | undefined,
  amountOf: (nutrient: TNutrient) => number | null | undefined,
) {
  return (nutrients: readonly TNutrient[] | null | undefined, fdcNumber: string): number | undefined => {
    if (nutrients === null || nutrients === undefined) {
      return undefined;
    }
    for (const nutrient of nutrients) {
      const rawNumber = numberOf(nutrient);
      if (rawNumber === null || rawNumber === undefined) {
        continue;
      }
      if (String(rawNumber) !== fdcNumber) {
        continue;
      }
      const amount = amountOf(nutrient);
      return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
        ? amount
        : undefined;
    }
    return undefined;
  };
}

/**
 * Un nutriente de un resultado de BÚSQUEDA (`/foods/search`): el número viaja
 * en `nutrientNumber` y la cantidad en `value`. Ver `schemas.ts` para la forma
 * completa validada.
 */
export interface FdcSearchNutrientLike {
  readonly nutrientNumber?: string | number | null | undefined;
  readonly value?: number | null | undefined;
}

/**
 * Un nutriente de una ficha pedida con `format=abridged`: el número viaja en
 * `number` y la cantidad en `amount`. Es una forma distinta de la misma API,
 * no una elección nuestra (D-047, "Consecuencias").
 */
export interface FdcDetailNutrientLike {
  readonly number?: string | number | null | undefined;
  readonly amount?: number | null | undefined;
}

export const findInSearchNutrients = makeAmountFinder<FdcSearchNutrientLike>(
  (n) => n.nutrientNumber,
  (n) => n.value,
);

export const findInDetailNutrients = makeAmountFinder<FdcDetailNutrientLike>(
  (n) => n.number,
  (n) => n.amount,
);

/** Envuelve un número crudo con la unidad que le corresponde según el catálogo. */
export function microAmountFor(id: MicronutrientId, amount: number): MicronutrientAmount {
  return unitOf(id) === 'mg' ? milligrams(amount) : micrograms(amount);
}
