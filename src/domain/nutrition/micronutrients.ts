import type { Micrograms, Milligrams } from '@/domain/units/units';

/** Unidad en la que se mide un micronutriente: miligramos o microgramos. */
export type MicronutrientUnit = 'mg' | 'ug';

interface MicronutrientMeta {
  readonly unit: MicronutrientUnit;
  readonly label: string;
}

/**
 * Catálogo único de micronutrientes. Es la fuente de verdad: el tipo
 * `Micronutrients` se deriva de aquí, así que añadir una vitamina es añadir una
 * línea y nada más.
 *
 * `as const` congela los valores en sus literales exactos, y `satisfies`
 * comprueba que el objeto cumple la forma esperada sin ensanchar esos literales.
 * Con una anotación normal, `unit` pasaría a ser `MicronutrientUnit` y
 * perderíamos la información de qué unidad concreta usa cada nutriente.
 *
 * Los valores de referencia diarios, con su fuente citada, llegan en la fase 2.
 */
export const MICRONUTRIENTS = {
  vitaminA: { unit: 'ug', label: 'Vitamina A' },
  vitaminC: { unit: 'mg', label: 'Vitamina C' },
  vitaminD: { unit: 'ug', label: 'Vitamina D' },
  vitaminE: { unit: 'mg', label: 'Vitamina E' },
  vitaminK: { unit: 'ug', label: 'Vitamina K' },
  thiamin: { unit: 'mg', label: 'Tiamina (B1)' },
  riboflavin: { unit: 'mg', label: 'Riboflavina (B2)' },
  niacin: { unit: 'mg', label: 'Niacina (B3)' },
  vitaminB6: { unit: 'mg', label: 'Vitamina B6' },
  folate: { unit: 'ug', label: 'Folato' },
  vitaminB12: { unit: 'ug', label: 'Vitamina B12' },
  calcium: { unit: 'mg', label: 'Calcio' },
  iron: { unit: 'mg', label: 'Hierro' },
  magnesium: { unit: 'mg', label: 'Magnesio' },
  phosphorus: { unit: 'mg', label: 'Fósforo' },
  potassium: { unit: 'mg', label: 'Potasio' },
  sodium: { unit: 'mg', label: 'Sodio' },
  zinc: { unit: 'mg', label: 'Zinc' },
  copper: { unit: 'mg', label: 'Cobre' },
  selenium: { unit: 'ug', label: 'Selenio' },
  iodine: { unit: 'ug', label: 'Yodo' },
  manganese: { unit: 'mg', label: 'Manganeso' },
} as const satisfies Record<string, MicronutrientMeta>;

export type MicronutrientId = keyof typeof MICRONUTRIENTS;

export const MICRONUTRIENT_IDS = Object.keys(MICRONUTRIENTS) as readonly MicronutrientId[];

/** La unidad declarada para un micronutriente concreto. */
type UnitOf<K extends MicronutrientId> = (typeof MICRONUTRIENTS)[K]['unit'];

/**
 * Tipo condicional: funciona como un `if` a nivel de tipos. Según lo que diga el
 * catálogo, resuelve a `Milligrams` o a `Micrograms`.
 */
type AmountOf<U extends MicronutrientUnit> = U extends 'mg' ? Milligrams : Micrograms;

/**
 * Cada micronutriente lleva el tipo de la unidad que le corresponde. Asignar
 * microgramos al hierro, que está declarado en miligramos, no compila.
 *
 * Igual que en los macronutrientes, la clave ausente significa "no se sabe".
 */
export type Micronutrients = {
  readonly [K in MicronutrientId]?: AmountOf<UnitOf<K>>;
};

/** La unidad de un micronutriente, en tiempo de ejecución, para la presentación. */
export const unitOf = (id: MicronutrientId): MicronutrientUnit => MICRONUTRIENTS[id].unit;

/** La etiqueta legible de un micronutriente. */
export const labelOf = (id: MicronutrientId): string => MICRONUTRIENTS[id].label;
