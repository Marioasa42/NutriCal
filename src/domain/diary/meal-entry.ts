import type {
  FoodSource,
  NutrientCompletion,
  NutrientProfile,
  ServingOption,
} from '@/domain/food/food';
import type { FoodId, MealEntryId, ServingId } from '@/domain/identity/ids';
import type { Persisted } from '@/domain/persistence/persisted';
import type { Instant, LocalDate } from '@/domain/time/local-date';
import type { Grams, Milliliters, Quantity } from '@/domain/units/units';

/** Momento del día al que se asigna la comida. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_SLOTS = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const satisfies readonly MealSlot[];

/**
 * Copia congelada del alimento en el momento de registrarlo.
 *
 * Esta es la pieza que hace que el historial sea tuyo: si mañana Open Food Facts
 * corrige las calorías de ese yogur, tu desayuno de hoy no cambia. Guardar solo
 * una referencia al producto externo dejaría tu pasado a merced de una base de
 * datos que no controlas.
 */
interface FoodSnapshotBase {
  readonly foodId: FoodId;
  readonly name: string;
  readonly brand?: string;
  readonly source: FoodSource;
  /** Por 100 unidades base, igual que en el alimento de origen. */
  readonly per100: NutrientProfile;
  readonly completion: NutrientCompletion;
  readonly capturedAt: Instant;
}

export interface MassFoodSnapshot extends FoodSnapshotBase {
  readonly baseUnit: 'g';
  readonly servings: readonly ServingOption<Grams>[];
}

export interface VolumeFoodSnapshot extends FoodSnapshotBase {
  readonly baseUnit: 'ml';
  readonly servings: readonly ServingOption<Milliliters>[];
}

export type FoodSnapshot = MassFoodSnapshot | VolumeFoodSnapshot;

/** Lo que eligió la persona usuaria, conservado tal cual para poder reeditarlo. */
export type PortionSelection<Q extends Quantity> =
  | { readonly kind: 'baseUnit'; readonly amount: Q }
  | { readonly kind: 'serving'; readonly servingId: ServingId; readonly count: number };

/**
 * La elección más su equivalencia en unidades base. Se guardan las dos cosas:
 * la elección porque es lo que la persona entiende y quiere volver a ver, y la
 * equivalencia porque es lo que usa el cálculo.
 */
export interface ResolvedPortion<Q extends Quantity> {
  readonly selection: PortionSelection<Q>;
  readonly amountInBaseUnit: Q;
}

interface MealEntryBase extends Persisted {
  readonly id: MealEntryId;
  /** Día local al que pertenece, nunca recalculado a partir de un instante. */
  readonly date: LocalDate;
  readonly slot: MealSlot;
  readonly note?: string;
}

/**
 * Un registro de comida. La intersección de la base con una unión emparejada
 * garantiza que la porción se mide en la misma unidad que el alimento: un
 * yogur en gramos no puede llevar una porción en mililitros.
 *
 * El registro no guarda los totales ya escalados. Los calcula una función pura
 * a partir de la instantánea y la porción, para que no existan dos copias del
 * mismo dato que puedan separarse.
 */
export type MealEntry = MealEntryBase &
  (
    | { readonly food: MassFoodSnapshot; readonly portion: ResolvedPortion<Grams> }
    | { readonly food: VolumeFoodSnapshot; readonly portion: ResolvedPortion<Milliliters> }
  );
