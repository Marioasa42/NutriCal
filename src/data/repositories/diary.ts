import { db, type NutriCalDatabase } from '@/data/db';
import { asDeleted } from '@/data/tombstone';
import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry, MealSlot } from '@/domain/diary/meal-entry';
import type { ExerciseEntryId, MealEntryId } from '@/domain/identity/ids';
import { isAlive } from '@/domain/persistence/persisted';
import { now, type Instant, type LocalDate } from '@/domain/time/local-date';

/**
 * Registros del diario, agrupados siempre por día local.
 *
 * El índice principal es `date`, una cadena `YYYY-MM-DD`. Consultar un día es
 * una lectura directa por índice, sin aritmética de husos horarios y sin
 * comparar instantes. Ese es el beneficio práctico de la decisión 3 del
 * proyecto, más allá de la corrección conceptual.
 */
export function createDiaryRepository(database: NutriCalDatabase) {
  return {
    async saveMeal(entry: MealEntry): Promise<void> {
      await database.mealEntries.put(entry);
    },

    async saveMeals(entries: readonly MealEntry[]): Promise<void> {
      await database.mealEntries.bulkPut([...entries]);
    },

    async mealById(id: MealEntryId): Promise<MealEntry | undefined> {
      const entry = await database.mealEntries.get(id);
      return entry !== undefined && isAlive(entry) ? entry : undefined;
    },

    /** Todas las comidas vivas de un día, en el orden en que se registraron. */
    async mealsOn(date: LocalDate): Promise<readonly MealEntry[]> {
      const entries = await database.mealEntries.where('date').equals(date).toArray();
      return entries.filter(isAlive).sort(byCreation);
    },

    /** Las comidas vivas de un momento concreto del día. Usa el índice compuesto. */
    async mealsOnSlot(date: LocalDate, slot: MealSlot): Promise<readonly MealEntry[]> {
      const entries = await database.mealEntries
        .where('[date+slot]')
        .equals([date, slot])
        .toArray();
      return entries.filter(isAlive).sort(byCreation);
    },

    async removeMeal(id: MealEntryId, at: Instant = now()): Promise<void> {
      const entry = await database.mealEntries.get(id);
      if (entry === undefined) {
        return;
      }
      await database.mealEntries.put(asDeleted(entry, at));
    },

    async saveExercise(entry: ExerciseEntry): Promise<void> {
      await database.exerciseEntries.put(entry);
    },

    async exerciseById(id: ExerciseEntryId): Promise<ExerciseEntry | undefined> {
      const entry = await database.exerciseEntries.get(id);
      return entry !== undefined && isAlive(entry) ? entry : undefined;
    },

    async exerciseOn(date: LocalDate): Promise<readonly ExerciseEntry[]> {
      const entries = await database.exerciseEntries.where('date').equals(date).toArray();
      return entries.filter(isAlive).sort(byCreation);
    },

    async removeExercise(id: ExerciseEntryId, at: Instant = now()): Promise<void> {
      const entry = await database.exerciseEntries.get(id);
      if (entry === undefined) {
        return;
      }
      await database.exerciseEntries.put(asDeleted(entry, at));
    },

    /** Los días que tienen algún registro vivo, para pintar el calendario. */
    async datesWithEntries(): Promise<readonly LocalDate[]> {
      const [meals, exercise] = await Promise.all([
        database.mealEntries.toArray(),
        database.exerciseEntries.toArray(),
      ]);
      const dates = new Set<LocalDate>();
      for (const entry of [...meals, ...exercise]) {
        if (isAlive(entry)) {
          dates.add(entry.date);
        }
      }
      return [...dates].sort((a, b) => a.localeCompare(b));
    },
  };
}

const byCreation = (a: { createdAt: Instant }, b: { createdAt: Instant }): number =>
  a.createdAt.localeCompare(b.createdAt);

export const diaryRepository = createDiaryRepository(db);
