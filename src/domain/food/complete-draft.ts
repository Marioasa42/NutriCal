import type { FoodDraft } from '@/domain/food/draft';
import type { Food, ServingOption } from '@/domain/food/food';
import { newFoodId, type FoodId } from '@/domain/identity/ids';
import type { Macros, RequiredMacroKey } from '@/domain/nutrition/macros';
import { now, type Instant } from '@/domain/time/local-date';
import {
  grams,
  kilocalories,
  milliliters,
  type Grams,
  type Milliliters,
  type Quantity,
} from '@/domain/units/units';

/**
 * Completar a mano un producto al que la fuente no le aporta todas las macros
 * del núcleo, para convertirlo en un `Food` que ya se puede registrar.
 *
 * Es la segunda mitad de D-002. La primera fue reconocer que un producto
 * incompleto no es un error sino un caso de uso; esta es la que lo arregla. Lo
 * importante no es rellenar los huecos, es dejar constancia de quién los
 * rellenó: `completion.userFilled` guarda las claves que puso la persona
 * usuaria, y `FoodSnapshot` se lo lleva al registro, de modo que la interfaz
 * puede marcar esas cifras como estimación meses después.
 */

/**
 * Lo que se teclea en el formulario: un número por cada macro que falta.
 *
 * Son números pelados y sin unidad por el mismo motivo que en `PortionChoice`:
 * vienen de un campo de texto. La unidad la pone esta función, que es quien sabe
 * que la energía va en kilocalorías y el resto en gramos por cien unidades base.
 *
 * `Partial<Record<...>>` en lugar de exigir todas las claves: el formulario se
 * puede enviar a medias, y esta función tiene que poder decir qué falta todavía
 * en vez de recibir siempre un objeto completo que no sabría construir.
 */
export type FilledMacros = Readonly<Partial<Record<RequiredMacroKey, number>>>;

/**
 * Lo que puede salir de completar, como unión discriminada.
 *
 * Mismo criterio que `createMealEntry`: lo que falta o está mal tecleado es
 * entrada de la persona usuaria, no un fallo de programación, así que sale por
 * una rama con nombre y no por una excepción.
 */
export type DraftCompletion =
  | { readonly kind: 'completed'; readonly food: Food }
  | { readonly kind: 'stillMissing'; readonly missing: readonly RequiredMacroKey[] }
  | { readonly kind: 'invalidValue'; readonly key: RequiredMacroKey; readonly value: number };

export interface CompleteDraftContext {
  readonly now: () => Instant;
  readonly newFoodId: () => FoodId;
}

export const defaultCompleteDraftContext: CompleteDraftContext = { now, newFoodId };

/**
 * Un valor tecleado vale si es finito y no negativo.
 *
 * Aquí el cero SÍ es válido, al revés que en una porción, y la diferencia
 * importa: el agua tiene cero calorías de verdad y una bebida sin azúcar tiene
 * cero gramos de azúcar. Cero es una medida; lo que no puede haber es media
 * ración de nada.
 */
const isUsableValue = (value: number): boolean => Number.isFinite(value) && value >= 0;

/**
 * Rehace las porciones con el constructor de la unidad que toca.
 *
 * `FoodDraft.servings` es `ServingOption<Quantity>[]`, que es la unión de las dos
 * unidades, porque un borrador todavía no se ha comprometido con ninguna. Un
 * `Food` sí, así que hay que volver a construir cada cantidad. Se rehace en vez
 * de afirmar el tipo: los números son los mismos, pero pasar por el constructor
 * es lo que hace que la marca sea verdad y no una promesa. El identificador de
 * cada porción se conserva, porque es el que ya vio la persona usuaria en la
 * pantalla de la que viene el borrador.
 */
function massServings(
  servings: readonly ServingOption<Quantity>[],
): readonly ServingOption<Grams>[] {
  return servings.map((option) => ({
    id: option.id,
    label: option.label,
    amountInBaseUnit: grams(option.amountInBaseUnit),
  }));
}

function volumeServings(
  servings: readonly ServingOption<Quantity>[],
): readonly ServingOption<Milliliters>[] {
  return servings.map((option) => ({
    id: option.id,
    label: option.label,
    amountInBaseUnit: milliliters(option.amountInBaseUnit),
  }));
}

/** La macro rellenada, ya con su unidad: kilocalorías la energía, gramos el resto. */
function withUnit(key: RequiredMacroKey, value: number): Macros[RequiredMacroKey] {
  return key === 'energy' ? kilocalories(value) : grams(value);
}

export function completeDraft(
  draft: FoodDraft,
  filled: FilledMacros,
  context: CompleteDraftContext = defaultCompleteDraftContext,
): DraftCompletion {
  const pending: RequiredMacroKey[] = [];
  const added: Partial<Macros> = {};

  for (const key of draft.missing) {
    const value = filled[key];
    if (value === undefined) {
      pending.push(key);
      continue;
    }
    if (!isUsableValue(value)) {
      return { kind: 'invalidValue', key, value };
    }
    Object.assign(added, { [key]: withUnit(key, value) });
  }

  if (pending.length > 0) {
    return { kind: 'stillMissing', missing: pending };
  }

  // Tras el bucle, las cuatro obligatorias están: las que traía la fuente seguían
  // en `draft.macros` y las que faltaban acaban de añadirse, porque `missing`
  // enumera exactamente las que no venían. `Partial<Macros>` no puede saberlo, y
  // por eso la aserción queda confinada a esta línea, sostenida por la
  // comprobación de justo encima. Es el mismo patrón que usa `normalizeProduct`.
  const macros = { ...draft.macros, ...added } as Macros;

  const at = context.now();
  const shared = {
    id: context.newFoodId(),
    name: draft.name,
    ...(draft.brand !== undefined ? { brand: draft.brand } : {}),
    source: draft.source,
    per100: { macros, micros: draft.micros },
    // Aquí es donde queda escrito qué cifras son estimación. `userFilled` lleva
    // las claves, no un booleano, porque la interfaz necesita marcar la cifra
    // concreta y no el alimento entero (D-002).
    completion: { userFilled: [...draft.missing], completedAt: at },
    createdAt: at,
    updatedAt: at,
  };

  const food: Food =
    draft.baseUnit === 'ml'
      ? { ...shared, baseUnit: 'ml', servings: volumeServings(draft.servings) }
      : { ...shared, baseUnit: 'g', servings: massServings(draft.servings) };

  return { kind: 'completed', food };
}
