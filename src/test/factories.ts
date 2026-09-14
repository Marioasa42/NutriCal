import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry, MealSlot, MassFoodSnapshot } from '@/domain/diary/meal-entry';
import type { MassFood } from '@/domain/food/food';
import type { DailyGoals } from '@/domain/goals/goals';
import {
  newExerciseEntryId,
  newFoodId,
  newGoalsId,
  newMealEntryId,
  newProfileId,
  newServingId,
  type FoodId,
  type MealEntryId,
} from '@/domain/identity/ids';
import type { Profile } from '@/domain/profile/profile';
import { instant, localDate, type Instant, type LocalDate } from '@/domain/time/local-date';
import { grams, kilocalories, milligrams, minutes } from '@/domain/units/units';

/**
 * Constructores de datos de prueba.
 *
 * Cada fábrica devuelve una entidad válida y completa, y recibe solo los campos
 * que el test necesita variar. Así un test dice únicamente lo que le importa, y
 * cuando el dominio gane un campo obligatorio hay un solo sitio que tocar.
 */

const DEFAULT_INSTANT = instant('2026-09-12T10:00:00.000Z');
const DEFAULT_DATE = localDate('2026-09-12');

export const anInstant = (value = '2026-09-12T10:00:00.000Z'): Instant => instant(value);
export const aDate = (value = '2026-09-12'): LocalDate => localDate(value);

export function makeFood(
  options: {
    id?: FoodId;
    name?: string;
    brand?: string;
    barcode?: string;
    fdcId?: number;
    energyKcal?: number;
    proteinG?: number;
    createdAt?: Instant;
    deletedAt?: Instant;
  } = {},
): MassFood {
  const {
    id = newFoodId(),
    name = 'Manzana',
    brand,
    barcode,
    fdcId,
    energyKcal = 52,
    proteinG = 0.3,
    createdAt = DEFAULT_INSTANT,
    deletedAt,
  } = options;

  return {
    id,
    name,
    ...(brand !== undefined ? { brand } : {}),
    source:
      barcode !== undefined
        ? { kind: 'openFoodFacts', barcode, fetchedAt: createdAt }
        : fdcId !== undefined
          ? { kind: 'usda', fdcId, fetchedAt: createdAt }
          : { kind: 'custom' },
    baseUnit: 'g',
    per100: {
      macros: {
        energy: kilocalories(energyKcal),
        protein: grams(proteinG),
        carbohydrates: grams(13.8),
        fat: grams(0.2),
        fiber: grams(2.4),
      },
      micros: {
        vitaminC: milligrams(4.6),
        potassium: milligrams(107),
      },
    },
    completion: { userFilled: [] },
    servings: [{ id: newServingId(), label: '1 unidad mediana', amountInBaseUnit: grams(182) }],
    createdAt,
    updatedAt: createdAt,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

export function makeMealEntry(
  options: {
    id?: MealEntryId;
    date?: LocalDate;
    slot?: MealSlot;
    food?: MassFood;
    amountG?: number;
    createdAt?: Instant;
    deletedAt?: Instant;
  } = {},
): MealEntry {
  const {
    id = newMealEntryId(),
    date = DEFAULT_DATE,
    slot = 'breakfast',
    food = makeFood(),
    amountG = 150,
    createdAt = DEFAULT_INSTANT,
    deletedAt,
  } = options;

  const snapshot: MassFoodSnapshot = {
    foodId: food.id,
    name: food.name,
    ...(food.brand !== undefined ? { brand: food.brand } : {}),
    source: food.source,
    baseUnit: 'g',
    per100: food.per100,
    completion: food.completion,
    capturedAt: createdAt,
    servings: food.servings,
  };

  return {
    id,
    date,
    slot,
    food: snapshot,
    portion: {
      selection: { kind: 'baseUnit', amount: grams(amountG) },
      amountInBaseUnit: grams(amountG),
    },
    createdAt,
    updatedAt: createdAt,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

export function makeExerciseEntry(
  options: {
    date?: LocalDate;
    activityLabel?: string;
    durationMin?: number;
    energyKcal?: number;
    createdAt?: Instant;
    deletedAt?: Instant;
  } = {},
): ExerciseEntry {
  const {
    date = DEFAULT_DATE,
    activityLabel = 'Caminar',
    durationMin = 30,
    energyKcal = 120,
    createdAt = DEFAULT_INSTANT,
    deletedAt,
  } = options;

  return {
    id: newExerciseEntryId(),
    date,
    activityLabel,
    durationMinutes: minutes(durationMin),
    energy: kilocalories(energyKcal),
    energySource: { kind: 'manual' },
    createdAt,
    updatedAt: createdAt,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

export function makeGoals(
  options: {
    effectiveFrom?: LocalDate;
    energyKcal?: number;
    createdAt?: Instant;
    deletedAt?: Instant;
  } = {},
): DailyGoals {
  const {
    effectiveFrom = DEFAULT_DATE,
    energyKcal = 2200,
    createdAt = DEFAULT_INSTANT,
    deletedAt,
  } = options;

  return {
    id: newGoalsId(),
    effectiveFrom,
    energy: kilocalories(energyKcal),
    protein: grams(130),
    carbohydrates: grams(250),
    fat: grams(70),
    fiber: grams(30),
    micros: { iron: milligrams(14) },
    origin: { kind: 'manual' },
    createdAt,
    updatedAt: createdAt,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

export function makeProfile(options: { timeZone?: string; createdAt?: Instant } = {}): Profile {
  const { timeZone = 'Europe/Madrid', createdAt = DEFAULT_INSTANT } = options;

  return {
    id: newProfileId(),
    timeZone,
    locale: 'es-ES',
    display: { massUnit: 'metric', energyUnit: 'kcal', firstDayOfWeek: 'monday' },
    createdAt,
    updatedAt: createdAt,
  };
}
