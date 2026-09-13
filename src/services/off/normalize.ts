import type { FoodDraft, NormalizationResult } from '@/domain/food/draft';
import type { BaseUnit, Food, ServingOption } from '@/domain/food/food';
import { newFoodId, newServingId, type FoodId, type ServingId } from '@/domain/identity/ids';
import type { Macros, RequiredMacroKey } from '@/domain/nutrition/macros';
import { now, type Instant } from '@/domain/time/local-date';
import { grams, milliliters, type Grams, type Milliliters } from '@/domain/units/units';
import {
  gramsOf,
  parseNutrientValue,
  readEnergyKcal,
  readNutrient,
} from '@/services/off/nutriments';
import { offProductSchema, type OffProduct } from '@/services/off/schemas';

/**
 * Conversión de un producto de Open Food Facts a una entidad del dominio.
 *
 * Implementa la decisión D-002: esta función nunca lanza. Un producto al que le
 * faltan macros del núcleo no es un error, es un caso de uso, y sale por la rama
 * `needsCompletion` para que la interfaz pida los huecos a la persona usuaria.
 */

/**
 * Lo que la normalización puede responder.
 *
 * Son las dos ramas de `NormalizationResult` del dominio más una tercera que
 * vive solo aquí: algo que ni siquiera era un producto legible. Esa tercera rama
 * no sube al dominio porque no describe un alimento, describe un fallo de la
 * fuente, y sirve para que la búsqueda pueda saltarse una fila mala sin tirar la
 * página entera de resultados.
 *
 * Ampliar una unión discriminada añadiendo una rama con un `kind` nuevo es
 * idiomático: el `switch` sobre `kind` sigue estrechando igual de bien.
 */
export type ProductNormalization =
  NormalizationResult | { readonly kind: 'unreadable'; readonly reason: string };

/**
 * Las dependencias impuras, por parámetro.
 *
 * Sin esto la función leería el reloj y generaría identificadores por dentro, y
 * entonces dos llamadas con la misma entrada darían objetos distintos: ningún
 * test podría comparar el resultado completo. Con el contexto inyectado la
 * normalización vuelve a ser una función pura de sus argumentos.
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

/** Clave del diccionario de nutrientes que corresponde a cada macro opcional. */
const OPTIONAL_MACRO_KEYS = {
  sugars: 'sugars_100g',
  saturatedFat: 'saturated-fat_100g',
  fiber: 'fiber_100g',
  salt: 'salt_100g',
} as const satisfies Partial<Record<keyof Macros, string>>;

/**
 * Unidades de volumen y de masa tal y como aparecen escritas en el campo del
 * envase.
 *
 * Dentro de cada alternancia lo largo va antes que lo corto: `litros?` antes que
 * `l`, y `gramos?` y `gr` antes que `g`. La expresión regular prueba las
 * alternativas en orden y se queda con la primera que encaje, así que si `g` se
 * probara antes, ante "500 gr" consumiría la `g`, el `\b` del final
 * chocaría con la `r` y la señal se perdería.
 */
const VOLUME_IN_PACKAGE = /\d\s*(?:litros?|ml|cl|dl|l)\b/i;
const MASS_IN_PACKAGE = /\d\s*(?:kilos?|kg|gramos?|gr|mg|g)\b/i;

/**
 * La unidad base del alimento: si se mide en gramos o en mililitros.
 *
 * Manda el envase, no la tabla nutricional, y la Coca-Cola del fixture explica
 * por qué: viene en lata de 330 ml, su `serving_quantity` de 330 son mililitros,
 * y sin embargo declara `nutrition_data_per: "100g"`. Si hiciéramos caso a la
 * declaración, saldría un alimento en gramos con una porción que en realidad son
 * mililitros, que es justo la mezcla que la decisión D-005 existe para impedir,
 * solo que colada por dentro en forma de número suelto.
 *
 * La unidad base describe el alimento: lo que se envasa en mililitros es un
 * líquido y se sirve en mililitros. La diferencia entre "por 100 g" y "por
 * 100 ml" en una bebida son décimas por la densidad; la incoherencia entre la
 * unidad base y sus porciones sería un error de verdad.
 *
 * El envase manda en las dos direcciones, y esto no es simetría por gusto. Un
 * sólido cuya tabla se declara por 100 ml es el mismo error de la fuente visto
 * del revés, y produce el mismo daño: un alimento en mililitros con una porción
 * que el envase declaraba en gramos. Por eso se busca también la señal de masa,
 * y no solo la de volumen: "el envase no dice volumen" y "el envase no dice
 * nada" son hechos distintos, y solo el segundo justifica mirar la tabla.
 *
 * `nutrition_data_per` sigue siendo útil como segunda señal, para los productos
 * que de verdad no declaran envase. Ante la duda, gramos, que es el caso
 * mayoritario.
 */
export function readBaseUnit(product: OffProduct): BaseUnit {
  // Gana la primera señal que aparezca, y `quantity` se mira antes que
  // `serving_size` porque describe el envase entero y no una ración suelta.
  for (const declaredSize of [product.quantity, product.serving_size]) {
    const declared = declaredSize ?? '';
    if (VOLUME_IN_PACKAGE.test(declared)) {
      return 'ml';
    }
    if (MASS_IN_PACKAGE.test(declared)) {
      return 'g';
    }
  }

  return product.nutrition_data_per?.trim().toLowerCase().includes('ml') === true ? 'ml' : 'g';
}

/** El nombre que se muestra. Se prefiere el castellano porque la app está en español. */
function readName(product: OffProduct): string | undefined {
  for (const candidate of [product.product_name_es, product.product_name]) {
    const trimmed = candidate?.trim();
    if (trimmed !== undefined && trimmed !== '') {
      return trimmed;
    }
  }
  return undefined;
}

/** `brands` llega como lista separada por comas. Nos quedamos con la primera. */
function readBrand(product: OffProduct): string | undefined {
  const first = product.brands?.split(',')[0]?.trim();
  return first === undefined || first === '' ? undefined : first;
}

/**
 * La cantidad de una porción, en la unidad base.
 *
 * Reutiliza el mismo lector que los nutrientes, y por el mismo motivo: la fuente
 * manda aquí números, cadenas y nulos indistintamente. Una porción de cero se
 * descarta porque no se puede servir, y esa es la única diferencia con un
 * nutriente, donde el cero sí es una medida perfectamente válida.
 */
function readServingAmount(product: OffProduct): number | undefined {
  const read = parseNutrientValue(product.serving_quantity);
  return read.kind === 'value' && read.value > 0 ? read.value : undefined;
}

function readServingLabel(product: OffProduct, amount: number, baseUnit: BaseUnit): string {
  const declared = product.serving_size?.trim();
  // `serving_size` es texto libre y a veces trae solo el número, como `"100"`.
  // En ese caso se construye una etiqueta legible en lugar de mostrarlo pelado.
  if (declared !== undefined && declared !== '' && /[a-z]/i.test(declared)) {
    return declared;
  }
  return `${amount} ${baseUnit}`;
}

/** Las macros que la fuente sí aporta, con el cero preservado como valor real. */
function readMacros(product: OffProduct): {
  readonly partial: Partial<Macros>;
  readonly missing: readonly RequiredMacroKey[];
} {
  const nutriments = product.nutriments;

  const energy = readEnergyKcal(nutriments);
  const protein = gramsOf(readNutrient(nutriments, 'proteins_100g'));
  const carbohydrates = gramsOf(readNutrient(nutriments, 'carbohydrates_100g'));
  const fat = gramsOf(readNutrient(nutriments, 'fat_100g'));

  const optional: Partial<Macros> = {};
  for (const [macroKey, sourceKey] of Object.entries(OPTIONAL_MACRO_KEYS)) {
    const value = gramsOf(readNutrient(nutriments, sourceKey));
    // La clave solo se escribe cuando hay un número detrás. Si el nutriente no
    // venía, no se escribe nada: ausente significa desconocido, según D-001.
    if (value !== undefined) {
      Object.assign(optional, { [macroKey]: value });
    }
  }

  const partial: Partial<Macros> = {
    ...(energy !== undefined ? { energy } : {}),
    ...(protein !== undefined ? { protein } : {}),
    ...(carbohydrates !== undefined ? { carbohydrates } : {}),
    ...(fat !== undefined ? { fat } : {}),
    ...optional,
  };

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

function buildMassServings(
  amount: number | undefined,
  label: string,
  context: NormalizationContext,
): readonly ServingOption<Grams>[] {
  return amount === undefined
    ? []
    : [{ id: context.newServingId(), label, amountInBaseUnit: grams(amount) }];
}

function buildVolumeServings(
  amount: number | undefined,
  label: string,
  context: NormalizationContext,
): readonly ServingOption<Milliliters>[] {
  return amount === undefined
    ? []
    : [{ id: context.newServingId(), label, amountInBaseUnit: milliliters(amount) }];
}

/**
 * Normaliza un producto, venga de una búsqueda o de un código de barras.
 *
 * Recibe `unknown` porque es lo que entrega la envoltura de nuestra API: la
 * validación del producto ocurre aquí dentro, producto a producto, para que uno
 * ilegible no arrastre a los demás de la misma página.
 */
export function normalizeProduct(
  raw: unknown,
  context: NormalizationContext = defaultNormalizationContext,
): ProductNormalization {
  const parsed = offProductSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: 'unreadable', reason: 'El producto no tiene la forma esperada.' };
  }

  const product = parsed.data;

  const barcode = product.code?.trim();
  if (barcode === undefined || barcode === '') {
    return { kind: 'unreadable', reason: 'El producto no trae código de barras.' };
  }

  const name = readName(product);
  if (name === undefined) {
    return { kind: 'unreadable', reason: 'El producto no trae nombre.' };
  }

  const fetchedAt = context.now();
  const brand = readBrand(product);
  const baseUnit = readBaseUnit(product);
  const { partial, missing } = readMacros(product);

  const servingAmount = readServingAmount(product);
  const servingLabel =
    servingAmount === undefined ? '' : readServingLabel(product, servingAmount, baseUnit);

  const identity = {
    name,
    ...(brand !== undefined ? { brand } : {}),
    source: { kind: 'openFoodFacts', barcode, fetchedAt } as const,
  };

  if (missing.length > 0) {
    const draft: FoodDraft = {
      ...identity,
      baseUnit,
      macros: partial,
      // Los micronutrientes llegan en la fase 2, con USDA y con la tabla de
      // conversión por nutriente. Aquí quedan vacíos a propósito.
      micros: {},
      servings:
        baseUnit === 'ml'
          ? buildVolumeServings(servingAmount, servingLabel, context)
          : buildMassServings(servingAmount, servingLabel, context),
      missing,
    };
    return { kind: 'needsCompletion', draft };
  }

  // En esta rama las cuatro obligatorias están, porque `missing` está vacío, pero
  // `Partial<Macros>` no puede saberlo. La aserción queda confinada a esta línea
  // y la sostiene la comprobación de justo encima.
  const macros = partial as Macros;

  const shared = {
    ...identity,
    id: context.newFoodId(),
    per100: { macros, micros: {} },
    completion: { userFilled: [] },
    createdAt: fetchedAt,
    updatedAt: fetchedAt,
  };

  // La unidad base se decide una vez y cada rama construye sus porciones con el
  // constructor que le toca. Así no hace falta ninguna conversión de tipos para
  // satisfacer la unión discriminada de D-005: el alimento nace ya coherente.
  const food: Food =
    baseUnit === 'ml'
      ? {
          ...shared,
          baseUnit: 'ml',
          servings: buildVolumeServings(servingAmount, servingLabel, context),
        }
      : {
          ...shared,
          baseUnit: 'g',
          servings: buildMassServings(servingAmount, servingLabel, context),
        };

  return { kind: 'complete', food };
}

/** Resultado de normalizar una página entera de resultados de búsqueda. */
export interface NormalizedProducts {
  readonly foods: readonly Food[];
  readonly drafts: readonly FoodDraft[];
  /** Cuántas filas venían tan mal que ni se pudieron leer. */
  readonly unreadable: number;
}

/** Normaliza una página de resultados, apartando lo que no se pudo leer. */
export function normalizeProducts(
  raws: readonly unknown[],
  context: NormalizationContext = defaultNormalizationContext,
): NormalizedProducts {
  const foods: Food[] = [];
  const drafts: FoodDraft[] = [];
  let unreadable = 0;

  for (const raw of raws) {
    const result = normalizeProduct(raw, context);
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
