import type {
  MassFoodSnapshot,
  MealEntry,
  MealSlot,
  PortionSelection,
  VolumeFoodSnapshot,
} from '@/domain/diary/meal-entry';
import { resolvePortion } from '@/domain/diary/portion';
import type { Food, MassFood, VolumeFood } from '@/domain/food/food';
import { newMealEntryId, type MealEntryId, type ServingId } from '@/domain/identity/ids';
import { now, type Instant, type LocalDate } from '@/domain/time/local-date';
import {
  grams,
  milliliters,
  type Grams,
  type Milliliters,
  type Quantity,
} from '@/domain/units/units';

/**
 * Convertir un alimento del catálogo en un registro del diario.
 *
 * Es el punto donde se cumple la decisión 2 del proyecto: aquí se copia la
 * instantánea nutricional dentro del registro (D-003), de modo que si mañana la
 * fuente corrige sus cifras, este desayuno no cambia. El registro guarda el
 * perfil por cien unidades base y la porción, nunca los totales ya escalados.
 */

/**
 * Lo que elige quien rellena el formulario, antes de tener unidad.
 *
 * `amount` y `count` son números pelados a propósito: vienen de un campo de
 * texto y nadie los ha validado todavía. Qué unidad les corresponde no lo decide
 * el formulario, lo decide el alimento, y por eso esta función lo resuelve por
 * dentro en lugar de pedir un `Grams` que quien llama tendría que construir
 * adivinando la unidad. Es lo que impide que un formulario mande gramos a una
 * bebida (D-005).
 */
export type PortionChoice =
  | { readonly kind: 'baseUnit'; readonly amount: number }
  | { readonly kind: 'serving'; readonly servingId: ServingId; readonly count: number };

/**
 * Lo que puede salir de registrar, como unión discriminada.
 *
 * No lanza, por el mismo motivo que `resolvePortion` (D-025): las tres ramas de
 * fallo son entradas de la persona usuaria, no fallos de programación, y cada
 * una lleva consigo lo que hace falta para explicarla en pantalla. Con una
 * excepción, el formulario tendría que capturarla para distinguir entre "eso no
 * es una cantidad" y "esa ración ya no existe".
 */
export type MealEntryCreation =
  | { readonly kind: 'created'; readonly entry: MealEntry }
  | { readonly kind: 'invalidAmount'; readonly amount: number }
  | { readonly kind: 'unknownServing'; readonly servingId: ServingId }
  | { readonly kind: 'invalidCount'; readonly count: number };

/**
 * Las dependencias impuras, por parámetro, igual que en la normalización.
 *
 * Sin esto, dos llamadas con la misma entrada darían registros distintos, porque
 * cada una leería el reloj y generaría un identificador nuevo, y ningún test
 * podría comparar el resultado completo.
 */
export interface LogMealContext {
  readonly now: () => Instant;
  readonly newMealEntryId: () => MealEntryId;
}

export const defaultLogMealContext: LogMealContext = { now, newMealEntryId };

export interface LogMealInput {
  readonly food: Food;
  readonly date: LocalDate;
  readonly slot: MealSlot;
  readonly choice: PortionChoice;
}

/**
 * Una cantidad tecleada solo vale si es un número finito y mayor que cero.
 *
 * Cero no es una porción que se pueda servir, el mismo criterio que aplica
 * `resolvePortion` al número de raciones y la normalización al descartar un
 * `serving_quantity` de cero. Se comprueba aquí, antes del constructor de la
 * unidad, porque `grams()` lanzaría y eso convertiría un dato mal tecleado en
 * un error de programación.
 */
const isUsableAmount = (amount: number): boolean => Number.isFinite(amount) && amount > 0;

/** La parte de la instantánea que no depende de si el alimento es masa o volumen. */
const snapshotBase = (food: Food, capturedAt: Instant) => ({
  foodId: food.id,
  name: food.name,
  ...(food.brand !== undefined ? { brand: food.brand } : {}),
  source: food.source,
  per100: food.per100,
  completion: food.completion,
  capturedAt,
});

const massSnapshot = (food: MassFood, capturedAt: Instant): MassFoodSnapshot => ({
  ...snapshotBase(food, capturedAt),
  baseUnit: 'g',
  servings: food.servings,
});

const volumeSnapshot = (food: VolumeFood, capturedAt: Instant): VolumeFoodSnapshot => ({
  ...snapshotBase(food, capturedAt),
  baseUnit: 'ml',
  servings: food.servings,
});

/**
 * Construye el registro.
 *
 * Las dos ramas están escritas por separado, y no con un genérico, por lo mismo
 * que decidió D-005: el emparejamiento entre la instantánea y su porción es una
 * unión discriminada, y estrechar por `baseUnit` es lo que hace que el
 * compilador acepte cada mitad sin ninguna aserción de tipo. El alimento nace
 * coherente en lugar de comprobarse después.
 */
export function createMealEntry(
  input: LogMealInput,
  context: LogMealContext = defaultLogMealContext,
): MealEntryCreation {
  const { food, date, slot, choice } = input;

  if (choice.kind === 'baseUnit' && !isUsableAmount(choice.amount)) {
    return { kind: 'invalidAmount', amount: choice.amount };
  }

  const at = context.now();
  const id = context.newMealEntryId();
  const common = { id, date, slot, createdAt: at, updatedAt: at };

  if (food.baseUnit === 'ml') {
    const selection: PortionSelection<Milliliters> =
      choice.kind === 'baseUnit'
        ? { kind: 'baseUnit', amount: milliliters(choice.amount) }
        : { kind: 'serving', servingId: choice.servingId, count: choice.count };

    const resolution = resolvePortion(food.servings, selection);
    if (resolution.kind !== 'resolved') {
      return resolution;
    }

    return {
      kind: 'created',
      entry: { ...common, food: volumeSnapshot(food, at), portion: resolution.portion },
    };
  }

  const selection: PortionSelection<Grams> =
    choice.kind === 'baseUnit'
      ? { kind: 'baseUnit', amount: grams(choice.amount) }
      : { kind: 'serving', servingId: choice.servingId, count: choice.count };

  const resolution = resolvePortion(food.servings, selection);
  if (resolution.kind !== 'resolved') {
    return resolution;
  }

  return {
    kind: 'created',
    entry: { ...common, food: massSnapshot(food, at), portion: resolution.portion },
  };
}

/**
 * La cantidad que hay que enseñar por defecto en el formulario.
 *
 * Cien unidades base, que es la cantidad de referencia del perfil (D-003): así
 * lo primero que se ve en la vista previa son exactamente las cifras de la
 * ficha, sin ninguna multiplicación de por medio que haya que entender.
 */
export const DEFAULT_PORTION_AMOUNT = 100;

/** La cantidad marcada que corresponde a un número en la unidad base del alimento. */
export function amountInBaseUnit(food: Pick<Food, 'baseUnit'>, amount: number): Quantity {
  return food.baseUnit === 'ml' ? milliliters(amount) : grams(amount);
}
