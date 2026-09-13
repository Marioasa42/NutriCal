import type { DayTotals, NutrientKey, UnknownNutrientCounts } from '@/domain/diary/day';
import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { NutrientProfile } from '@/domain/food/food';
import {
  buildMicronutrients,
  type MicronutrientAmount,
} from '@/domain/nutrition/build-micronutrients';
import { OPTIONAL_MACRO_KEYS, type Macros } from '@/domain/nutrition/macros';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import { scaleProfile } from '@/domain/nutrition/scaling';
import { grams, kilocalories, sum, type Grams } from '@/domain/units/units';

/**
 * Totales de un registro y de un día.
 *
 * El registro guarda el perfil por cien unidades base y la porción, nunca los
 * totales ya escalados (D-003). Se calculan aquí, y por eso esto es lo único que
 * hay que corregir si algún día la fórmula está mal: no hay cifras congeladas en
 * la base de datos repitiendo el error.
 */

/** El perfil nutricional de un registro, ya escalado a lo que se comió. */
export function entryTotals(entry: MealEntry): NutrientProfile {
  return scaleProfile(entry.food.per100, entry.portion.amountInBaseUnit);
}

/**
 * La suma de varios perfiles, con la cuenta de lo que no se sabe.
 *
 * `unknown` no es un extra: es lo que hace que el total signifique algo. Si tres
 * de tus cinco comidas no traían datos de hierro, la suma de las otras dos no es
 * "el hierro del día", y la interfaz tiene que poder decirlo en lugar de enseñar
 * un número que parece completo. Es la consecuencia que D-001 dejó escrita.
 */
export interface NutrientSum {
  readonly macros: Macros;
  readonly micros: Micronutrients;
  readonly unknown: UnknownNutrientCounts;
}

export function sumProfiles(profiles: readonly NutrientProfile[]): NutrientSum {
  const unknown: Partial<Record<NutrientKey, number>> = {};

  /** Apunta cuántos perfiles no aportaban este nutriente. Cero no se apunta. */
  const noteUnknown = (key: NutrientKey, knownCount: number): void => {
    const missing = profiles.length - knownCount;
    if (missing > 0) {
      unknown[key] = missing;
    }
  };

  // Las cuatro obligatorias existen siempre, porque `Macros` es estricto y ningún
  // alimento llega a serlo sin ellas (D-002). Nunca aparecen en `unknown`.
  const energy = sum(
    profiles.map((profile) => profile.macros.energy),
    kilocalories(0),
  );
  const protein = sum(
    profiles.map((profile) => profile.macros.protein),
    grams(0),
  );
  const carbohydrates = sum(
    profiles.map((profile) => profile.macros.carbohydrates),
    grams(0),
  );
  const fat = sum(
    profiles.map((profile) => profile.macros.fat),
    grams(0),
  );

  // Las opcionales se suman con lo que haya. Un nutriente que solo aportan
  // algunos registros se suma igualmente, y el recuento dice sobre cuántos se
  // calculó: es más útil que omitirlo, porque un mínimo conocido informa y una
  // ausencia total no (D-024).
  const optional: Partial<Record<(typeof OPTIONAL_MACRO_KEYS)[number], Grams>> = {};
  for (const key of OPTIONAL_MACRO_KEYS) {
    const known = profiles
      .map((profile) => profile.macros[key])
      .filter((amount): amount is Grams => amount !== undefined);

    if (known.length > 0) {
      optional[key] = sum(known, grams(0));
    }
    noteUnknown(key, known.length);
  }

  const micros = buildMicronutrients((id) => {
    const known = profiles
      .map((profile) => profile.micros[id])
      .filter((amount): amount is MicronutrientAmount => amount !== undefined);

    noteUnknown(id, known.length);

    // `known[0]` es el cero de la suma y ya lleva la unidad correcta de este
    // micronutriente, así que no hay que elegir entre miligramos y microgramos.
    const [first, ...rest] = known;
    return first === undefined ? undefined : sum(rest, first);
  });

  return {
    macros: { energy, protein, carbohydrates, fat, ...optional },
    micros,
    unknown,
  };
}

/**
 * El resumen nutricional de un día.
 *
 * Filtra las lápidas por su cuenta, igual que `goalsEffectiveOn`: los
 * repositorios ya excluyen lo borrado (D-014), pero un archivo de exportación sí
 * las lleva dentro a propósito (D-006), y esta función tiene que dar lo mismo
 * venga de donde venga lo que recibe.
 */
export function dayTotals(
  meals: readonly MealEntry[],
  exercise: readonly ExerciseEntry[],
): DayTotals {
  const live = meals.filter((entry) => entry.deletedAt === undefined);
  const { macros, micros, unknown } = sumProfiles(live.map(entryTotals));

  return {
    macros,
    micros,
    unknown,
    energyBurned: sum(
      exercise.filter((entry) => entry.deletedAt === undefined).map((entry) => entry.energy),
      kilocalories(0),
    ),
  };
}
