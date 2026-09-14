import type { FoodDraft, NormalizationResult } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import { buildMicronutrients } from '@/domain/nutrition/build-micronutrients';
import type { Macros, RequiredMacroKey } from '@/domain/nutrition/macros';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import { grams, kilocalories } from '@/domain/units/units';
import {
  FDC_MACRO_NUMBERS,
  FDC_NUTRIENT_NUMBERS,
  FDC_OPTIONAL_MACRO_NUMBERS,
  findInDetailNutrients,
  findInSearchNutrients,
  microAmountFor,
} from '@/services/usda/nutrients';
import { usdaFoodDetailSchema, usdaSearchFoodSchema } from '@/services/usda/schemas';
import {
  defaultNormalizationContext,
  type NormalizationContext,
} from '@/services/shared/normalization-context';

export { defaultNormalizationContext, type NormalizationContext };

/**
 * Conversión de un alimento de USDA FoodData Central a una entidad del
 * dominio.
 *
 * A diferencia de `services/off/normalize.ts`, aquí hay DOS puntos de
 * entrada, no uno, porque FDC responde dos formas de alimento realmente
 * distintas y con información distinta dentro:
 *
 * - `normalizeSearchFood`: un resultado de `/foods/search`. Trae identidad y
 *   las macros básicas, pero NO el panel de micronutrientes completo (D-048):
 *   una búsqueda real de un producto de marca solo trae 10-14 nutrientes, casi
 *   siempre sin buena parte de las vitaminas y minerales del catálogo.
 * - `normalizeFoodDetail`: la ficha de `/food/{fdcId}` pedida con
 *   `format=abridged`. Trae el mismo alimento con el panel completo.
 *
 * Guardar directamente lo que da la búsqueda como si fuera el perfil
 * definitivo congelaría en el catálogo, y más tarde en el historial (D-003),
 * un alimento con aspecto de dato completo y veintidós micronutrientes
 * ausentes que en realidad sí existen en la fuente y no se han pedido
 * todavía. `micros: {}` en el resultado de búsqueda es honesto -técnicamente
 * "ausente" ya significa "desconocido" (D-001)-, pero quien lo consuma tiene
 * que saber que ese desconocido es temporal y se puede resolver, cosa que le
 * corresponde decidir a la pantalla de búsqueda, no a este archivo, que es
 * código puro sin opinión sobre cuándo se pide la ficha.
 */

export type UsdaNormalization =
  NormalizationResult | { readonly kind: 'unreadable'; readonly reason: string };

interface UsdaIdentityFields {
  readonly fdcId: number;
  readonly description?: string | null | undefined;
  readonly brandOwner?: string | null | undefined;
  readonly brandName?: string | null | undefined;
}

function readName(food: UsdaIdentityFields): string | undefined {
  const trimmed = food.description?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/** `brandName` (la marca del producto) antes que `brandOwner` (la empresa): es lo más específico. */
function readBrand(food: UsdaIdentityFields): string | undefined {
  for (const candidate of [food.brandName, food.brandOwner]) {
    const trimmed = candidate?.trim();
    if (trimmed !== undefined && trimmed !== '') {
      return trimmed;
    }
  }
  return undefined;
}

/**
 * Lee las cuatro macros obligatorias y las tres opcionales que sabemos leer
 * de FDC (`salt` queda fuera a propósito, ver `nutrients.ts`).
 *
 * `find` ya lleva cerrada la lista de nutrientes y la forma que le
 * corresponde (búsqueda o ficha): esta función no sabe ni le importa cuál de
 * las dos es.
 */
function readMacros(find: (fdcNumber: string) => number | undefined): {
  readonly partial: Partial<Macros>;
  readonly missing: readonly RequiredMacroKey[];
} {
  const energy = find(FDC_MACRO_NUMBERS.energy);
  const protein = find(FDC_MACRO_NUMBERS.protein);
  const carbohydrates = find(FDC_MACRO_NUMBERS.carbohydrates);
  const fat = find(FDC_MACRO_NUMBERS.fat);

  const partial: Partial<Macros> = {
    ...(energy !== undefined ? { energy: kilocalories(energy) } : {}),
    ...(protein !== undefined ? { protein: grams(protein) } : {}),
    ...(carbohydrates !== undefined ? { carbohydrates: grams(carbohydrates) } : {}),
    ...(fat !== undefined ? { fat: grams(fat) } : {}),
  };

  for (const [macroKey, fdcNumber] of Object.entries(FDC_OPTIONAL_MACRO_NUMBERS)) {
    const value = find(fdcNumber);
    // La clave solo se escribe cuando hay un número detrás. D-001: ausente
    // significa desconocido, y no se escribe nada en ese caso.
    if (value !== undefined) {
      Object.assign(partial, { [macroKey]: grams(value) });
    }
  }

  const missing: RequiredMacroKey[] = [];
  if (energy === undefined) {
    missing.push('energy');
  }
  if (protein === undefined) {
    missing.push('protein');
  }
  if (carbohydrates === undefined) {
    missing.push('carbohydrates');
  }
  if (fat === undefined) {
    missing.push('fat');
  }

  return { partial, missing };
}

/** Lee el panel de micronutrientes completo. Solo tiene sentido con la ficha detallada. */
function readMicros(find: (fdcNumber: string) => number | undefined): Micronutrients {
  return buildMicronutrients((id) => {
    const fdcNumber = FDC_NUTRIENT_NUMBERS[id];
    if (fdcNumber === undefined) {
      // El yodo: sin número de FDC fiable, siempre desconocido. Ver `nutrients.ts`.
      return undefined;
    }
    const amount = find(fdcNumber);
    return amount === undefined ? undefined : microAmountFor(id, amount);
  });
}

/**
 * Todo alimento de USDA se mide en gramos.
 *
 * FDC no tiene el concepto de "envase declarado en volumen" que tiene Open
 * Food Facts (`readBaseUnit` de `off/normalize.ts`): su `foodNutrients[]`
 * está siempre referido a 100 g del alimento, sea sólido o líquido, y no
 * publica una unidad base alternativa. Por eso no hace falta detectar nada
 * aquí, a diferencia de OFF.
 */
function buildResult(
  fdcId: number,
  name: string,
  brand: string | undefined,
  macros: { readonly partial: Partial<Macros>; readonly missing: readonly RequiredMacroKey[] },
  micros: Micronutrients,
  context: NormalizationContext,
): NormalizationResult {
  const fetchedAt = context.now();
  const identity = {
    name,
    ...(brand !== undefined ? { brand } : {}),
    source: { kind: 'usda', fdcId, fetchedAt } as const,
  };

  if (macros.missing.length > 0) {
    const draft: FoodDraft = {
      ...identity,
      baseUnit: 'g',
      macros: macros.partial,
      micros,
      // Ni la búsqueda ni la ficha abreviada traen una ración con nombre (un
      // vaso, una rebanada): solo la referencia de 100 g. Quien registre
      // parte de ahí y escala a mano, igual que con un producto de OFF sin
      // `serving_quantity`.
      servings: [],
      missing: macros.missing,
    };
    return { kind: 'needsCompletion', draft };
  }

  const food: Food = {
    ...identity,
    id: context.newFoodId(),
    baseUnit: 'g',
    per100: { macros: macros.partial as Macros, micros },
    servings: [],
    completion: { userFilled: [] },
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
  };
  return { kind: 'complete', food };
}

/** Normaliza un elemento de `/foods/search`. Sin micronutrientes: ver el comentario de arriba. */
export function normalizeSearchFood(
  raw: unknown,
  context: NormalizationContext = defaultNormalizationContext,
): UsdaNormalization {
  const parsed = usdaSearchFoodSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: 'unreadable', reason: 'El alimento no tiene la forma esperada.' };
  }

  const food = parsed.data;
  const name = readName(food);
  if (name === undefined) {
    return { kind: 'unreadable', reason: 'El alimento no trae nombre.' };
  }

  const macros = readMacros((fdcNumber) => findInSearchNutrients(food.foodNutrients, fdcNumber));
  return buildResult(food.fdcId, name, readBrand(food), macros, {}, context);
}

/** Normaliza la ficha de `/food/{fdcId}?format=abridged`, con el panel completo. */
export function normalizeFoodDetail(
  raw: unknown,
  context: NormalizationContext = defaultNormalizationContext,
): UsdaNormalization {
  const parsed = usdaFoodDetailSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: 'unreadable', reason: 'El alimento no tiene la forma esperada.' };
  }

  const food = parsed.data;
  const name = readName(food);
  if (name === undefined) {
    return { kind: 'unreadable', reason: 'El alimento no trae nombre.' };
  }

  const find = (fdcNumber: string) => findInDetailNutrients(food.foodNutrients, fdcNumber);
  const macros = readMacros(find);
  const micros = readMicros(find);
  return buildResult(food.fdcId, name, readBrand(food), macros, micros, context);
}

/** Resultado de normalizar una página entera de resultados de búsqueda. */
export interface NormalizedUsdaFoods {
  readonly foods: readonly Food[];
  readonly drafts: readonly FoodDraft[];
  readonly unreadable: number;
}

/** Normaliza una página de resultados, apartando lo que no se pudo leer. */
export function normalizeSearchFoods(
  raws: readonly unknown[],
  context: NormalizationContext = defaultNormalizationContext,
): NormalizedUsdaFoods {
  const foods: Food[] = [];
  const drafts: FoodDraft[] = [];
  let unreadable = 0;

  for (const raw of raws) {
    const result = normalizeSearchFood(raw, context);
    switch (result.kind) {
      case 'complete':
        foods.push(result.food);
        break;
      case 'needsCompletion':
        drafts.push(result.draft);
        break;
      case 'unreadable':
        unreadable += 1;
        break;
    }
  }

  return { foods, drafts, unreadable };
}
