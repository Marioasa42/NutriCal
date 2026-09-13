import {
  MICRONUTRIENT_IDS,
  type MicronutrientId,
  type Micronutrients,
} from '@/domain/nutrition/micronutrients';
import type { Micrograms, Milligrams } from '@/domain/units/units';

/** Lo que puede medir un micronutriente: miligramos o microgramos, nunca gramos. */
export type MicronutrientAmount = Milligrams | Micrograms;

/**
 * Construye un mapa de micronutrientes calculando cada clave por separado.
 *
 * Existe para que la única aserción de tipo que este tipo obliga a escribir viva
 * en un solo sitio, igual que D-014 confinó la suya al desenvoltorio del
 * almacenamiento. Quien escala y quien suma micronutrientes pasan los dos por
 * aquí y no repiten la aserción ni su explicación.
 *
 * ## Por qué hace falta la aserción
 *
 * `Micronutrients` es un tipo mapeado en el que cada clave lleva la unidad que
 * le corresponde: `iron` es `Milligrams` y `folate` es `Micrograms`. Esa
 * correlación entre clave y unidad solo existe mientras la clave es un literal
 * concreto. En el momento en que se recorre el catálogo, la clave deja de ser
 * `'iron'` y pasa a ser `MicronutrientId`, que es la unión de las veintidós, y
 * el valor pasa a ser `Milligrams | Micrograms`. El compilador ya no sabe qué
 * clave tiene entre manos, así que tampoco puede saber qué mitad de esa unión le
 * toca.
 *
 * Y ante la duda no elige la mitad optimista, elige la única segura: para que
 * `built[id] = amount` valiera para cualquier `id` posible, `amount` tendría que
 * servir a la vez para todas las claves. Eso es la intersección de todas las
 * unidades, no su unión, y el compilador lo dice con estas palabras exactas:
 *
 * ```
 * Type 'Milligrams | Micrograms' is not assignable to type 'never'.
 *   The intersection '... "Micrograms" & ... "Milligrams"' was reduced to 'never'
 *   because property '[brand]' has conflicting types in some constituents.
 * ```
 *
 * Es la limitación conocida de TypeScript con los tipos de unión correlacionados.
 * No es que la escritura sea insegura: es que el lenguaje no tiene forma de
 * expresar "esta clave y este valor vienen emparejados" cuando la clave es una
 * variable. Por eso se acumula en un registro de valores más flojos y se afirma
 * el tipo una sola vez al devolver, en un punto donde la construcción es
 * evidentemente correcta porque cada valor sale de `amountFor(id)` con ese mismo
 * `id`.
 *
 * La alternativa sin aserción sería escribir las veintidós claves a mano en cada
 * función que produzca micronutrientes. El compilador quedaría contento y la
 * lista se desincronizaría del catálogo en cuanto se añadiera una vitamina.
 */
export function buildMicronutrients(
  amountFor: (id: MicronutrientId) => MicronutrientAmount | undefined,
): Micronutrients {
  const built: Partial<Record<MicronutrientId, MicronutrientAmount>> = {};

  for (const id of MICRONUTRIENT_IDS) {
    const amount = amountFor(id);
    // La clave solo se escribe si hay una medida detrás. Ausente significa
    // desconocido, según D-001, y eso tiene que sobrevivir a cualquier cálculo.
    if (amount !== undefined) {
      built[id] = amount;
    }
  }

  return built as Micronutrients;
}
