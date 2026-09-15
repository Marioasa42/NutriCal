import type { BaseUnit, Food, ServingOption } from '@/domain/food/food';
import { newFoodId, type FoodId } from '@/domain/identity/ids';
import { buildMicronutrients } from '@/domain/nutrition/build-micronutrients';
import {
  OPTIONAL_MACRO_KEYS,
  REQUIRED_MACRO_KEYS,
  type MacroKey,
  type Macros,
  type RequiredMacroKey,
} from '@/domain/nutrition/macros';
import {
  unitOf,
  type MicronutrientId,
  type Micronutrients,
} from '@/domain/nutrition/micronutrients';
import { scaleMacros, scaleMicros } from '@/domain/nutrition/scaling';
import { now, type Instant } from '@/domain/time/local-date';
import {
  grams,
  kilocalories,
  micrograms,
  milligrams,
  type Grams,
  type Milliliters,
} from '@/domain/units/units';

/**
 * Crear (o editar) un alimento propio desde cero, sin pasar por Open Food
 * Facts ni USDA.
 *
 * `FoodSource` tiene la rama `'custom'` desde el diseño del dominio, pero
 * hasta ahora solo la usaba el sembrado de ejemplo (`data/seed.ts`), con
 * identificadores y cifras fijas. Este es el primer camino que la construye
 * a partir de lo que teclee de verdad una persona.
 *
 * Reutiliza, sin reescribirlo, lo que ya existía para el caso parecido de
 * `complete-draft.ts` (una unión discriminada de resultado, un contexto
 * inyectable para el reloj y el generador de identificadores) y para el
 * escalado (`nutrition/scaling.ts`): quien rellena el formulario teclea los
 * valores "a la cantidad de referencia" que haya elegido -normalmente 100,
 * pero puede ser el peso de una ración casera-, y `scaleMacros`/`scaleMicros`
 * los llevan a los "por 100" que exige `NutrientProfile`, con el mismo
 * factor invertido con el que ya escalan en la otra dirección para calcular
 * los totales de una comida.
 */

export type CustomFoodMacroInput = Readonly<Partial<Record<MacroKey, number>>>;
export type CustomFoodMicroInput = Readonly<Partial<Record<MicronutrientId, number>>>;

export interface CustomFoodInput {
  readonly name: string;
  readonly brand?: string;
  readonly baseUnit: BaseUnit;
  /** En la unidad base elegida. Los macros y micros de abajo son "a esta cantidad". */
  readonly referenceAmount: number;
  readonly macros: CustomFoodMacroInput;
  readonly micros: CustomFoodMicroInput;
}

/**
 * Lo que puede salir de intentarlo, como unión discriminada: nada de esto es
 * un fallo de programación, es entrada de un formulario que puede estar a
 * medias o mal tecleada (mismo criterio que `DraftCompletion`).
 */
export type CreateCustomFoodResult =
  | { readonly kind: 'created'; readonly food: Food }
  | { readonly kind: 'missingMacros'; readonly missing: readonly RequiredMacroKey[] }
  | { readonly kind: 'invalidReferenceAmount' }
  | { readonly kind: 'invalidMacroValue'; readonly key: MacroKey; readonly value: number }
  | { readonly kind: 'invalidMicroValue'; readonly key: MicronutrientId; readonly value: number };

export interface CreateCustomFoodContext {
  readonly now: () => Instant;
  readonly newFoodId: () => FoodId;
}

export const defaultCreateCustomFoodContext: CreateCustomFoodContext = { now, newFoodId };

/**
 * Un valor tecleado vale si es finito y no negativo. Igual que en
 * `complete-draft.ts`: el cero sí es una medida legítima (el agua tiene cero
 * calorías de verdad), lo que no puede haber es una cantidad negativa.
 */
const isUsableValue = (value: number): boolean => Number.isFinite(value) && value >= 0;

function withMacroUnit(key: MacroKey, value: number): Macros[MacroKey] {
  return key === 'energy' ? kilocalories(value) : grams(value);
}

function withMicroUnit(id: MicronutrientId, value: number): Micronutrients[MicronutrientId] {
  return unitOf(id) === 'mg' ? milligrams(value) : micrograms(value);
}

type MacrosOutcome =
  | { readonly kind: 'ok'; readonly macros: Macros; readonly filled: readonly MacroKey[] }
  | { readonly kind: 'missingMacros'; readonly missing: readonly RequiredMacroKey[] }
  | { readonly kind: 'invalidMacroValue'; readonly key: MacroKey; readonly value: number };

/**
 * Aquí, a diferencia de `complete-draft.ts`, `filled` termina siendo TODAS
 * las claves con un valor, no solo las que "faltaban": no hay ninguna fuente
 * externa de la que faltara algo, todo lo puso la persona que lo creó.
 */
function buildMacrosAtReference(input: CustomFoodMacroInput): MacrosOutcome {
  const missing = REQUIRED_MACRO_KEYS.filter((key) => input[key] === undefined);
  if (missing.length > 0) {
    return { kind: 'missingMacros', missing };
  }

  const filled: MacroKey[] = [];
  const partial: Partial<Macros> = {};
  for (const key of [...REQUIRED_MACRO_KEYS, ...OPTIONAL_MACRO_KEYS]) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }
    if (!isUsableValue(value)) {
      return { kind: 'invalidMacroValue', key, value };
    }
    Object.assign(partial, { [key]: withMacroUnit(key, value) });
    filled.push(key);
  }

  // Las cuatro obligatorias ya se comprobaron arriba (`missing` vacío), así
  // que en este punto están todas. `Partial<Macros>` no puede saberlo, y por
  // eso la aserción queda confinada a esta línea, sostenida por la
  // comprobación de justo encima -el mismo patrón que ya usa `complete-draft.ts`.
  return { kind: 'ok', macros: partial as Macros, filled };
}

type MicrosOutcome =
  | { readonly kind: 'ok'; readonly micros: Micronutrients }
  | { readonly kind: 'invalidMicroValue'; readonly key: MicronutrientId; readonly value: number };

function buildMicrosAtReference(input: CustomFoodMicroInput): MicrosOutcome {
  let invalid: { key: MicronutrientId; value: number } | undefined;

  const micros = buildMicronutrients((id) => {
    const value = input[id];
    if (value === undefined) {
      return undefined;
    }
    if (!isUsableValue(value)) {
      invalid ??= { key: id, value };
      return undefined;
    }
    return withMicroUnit(id, value);
  });

  return invalid === undefined ? { kind: 'ok', micros } : { kind: 'invalidMicroValue', ...invalid };
}

export function createCustomFood(
  input: CustomFoodInput,
  context: CreateCustomFoodContext = defaultCreateCustomFoodContext,
): CreateCustomFoodResult {
  if (!Number.isFinite(input.referenceAmount) || input.referenceAmount <= 0) {
    return { kind: 'invalidReferenceAmount' };
  }

  const macrosOutcome = buildMacrosAtReference(input.macros);
  if (macrosOutcome.kind !== 'ok') {
    return macrosOutcome;
  }

  const microsOutcome = buildMicrosAtReference(input.micros);
  if (microsOutcome.kind !== 'ok') {
    return microsOutcome;
  }

  const factor = 100 / input.referenceAmount;
  const macros = scaleMacros(macrosOutcome.macros, factor);
  const micros = scaleMicros(microsOutcome.micros, factor);

  const at = context.now();
  const shared = {
    id: context.newFoodId(),
    name: input.name,
    ...(input.brand !== undefined ? { brand: input.brand } : {}),
    source: { kind: 'custom' } as const,
    per100: { macros, micros },
    // Todo lo que se tecleó cuenta como estimación de la persona usuaria, no
    // como dato de una fuente externa (D-002 aplicado al revés: aquí no hay
    // fuente de la que faltara algo, la fuente es la propia persona).
    completion: { userFilled: macrosOutcome.filled, completedAt: at },
    createdAt: at,
    updatedAt: at,
  };

  const food: Food =
    input.baseUnit === 'ml'
      ? { ...shared, baseUnit: 'ml', servings: [] as readonly ServingOption<Milliliters>[] }
      : { ...shared, baseUnit: 'g', servings: [] as readonly ServingOption<Grams>[] };

  return { kind: 'created', food };
}

/**
 * Editar un alimento propio ya existente.
 *
 * Comparte toda la validación y el ensamblado con `createCustomFood`: la
 * única diferencia es qué campos de identidad se conservan. `id` se
 * conserva forzando el generador a devolver siempre el mismo, y `createdAt`
 * se restaura después porque `createCustomFood` lo pondría a "ahora" como
 * si fuera nuevo. `updatedAt` sí se queda en "ahora": es exactamente lo que
 * debe pasar en una edición.
 *
 * Esto NO toca ningún registro del diario que ya use este alimento: D-003
 * (la instantánea) hace que `MealEntry.food` sea una copia congelada en el
 * momento de registrar, no una referencia a este `Food`. Editar aquí cambia
 * lo que se vea al registrar de nuevo, nunca lo ya registrado.
 */
export function updateCustomFood(
  existing: Food,
  input: CustomFoodInput,
  context: CreateCustomFoodContext = defaultCreateCustomFoodContext,
): CreateCustomFoodResult {
  const result = createCustomFood(input, { now: context.now, newFoodId: () => existing.id });
  return result.kind === 'created'
    ? { kind: 'created', food: { ...result.food, createdAt: existing.createdAt } }
    : result;
}
