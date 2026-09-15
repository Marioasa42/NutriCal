import { db, type NutriCalDatabase } from '@/data/db';
import { ALIVE, fromStored, toStored } from '@/data/stored';
import { asDeleted, asRestored } from '@/data/tombstone';
import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry, MealSlot } from '@/domain/diary/meal-entry';
import type { ExerciseEntryId, MealEntryId } from '@/domain/identity/ids';
import { now, type Instant, type LocalDate } from '@/domain/time/local-date';

/**
 * Registros del diario, agrupados siempre por día local.
 *
 * El índice es `[isDeleted+date]`, con la fecha como cadena `YYYY-MM-DD`.
 * Consultar un día es una lectura directa por índice que además excluye las
 * lápidas sin leerlas, sin aritmética de husos horarios y sin comparar
 * instantes. Ese es el beneficio práctico de la decisión 3 del proyecto, más
 * allá de la corrección conceptual.
 *
 * El orden por momento de creación se hace en memoria a propósito: un día tiene
 * unos pocos registros, y meter `createdAt` en el índice lo ensancharía sin
 * ganancia medible.
 */
export function createDiaryRepository(database: NutriCalDatabase) {
  return {
    async saveMeal(entry: MealEntry): Promise<void> {
      await database.mealEntries.put(toStored(entry));
    },

    async saveMeals(entries: readonly MealEntry[]): Promise<void> {
      await database.mealEntries.bulkPut(entries.map(toStored));
    },

    async mealById(id: MealEntryId): Promise<MealEntry | undefined> {
      const stored = await database.mealEntries.get(id);
      if (stored?.isDeleted !== ALIVE) {
        return undefined;
      }
      return fromStored(stored);
    },

    /** Todas las comidas vivas de un día, en el orden en que se registraron. */
    async mealsOn(date: LocalDate): Promise<readonly MealEntry[]> {
      const stored = await database.mealEntries
        .where('[isDeleted+date]')
        .equals([ALIVE, date])
        .toArray();
      return stored.map(fromStored).sort(byCreation);
    },

    /** Las comidas vivas de un momento concreto del día. Usa el índice compuesto. */
    async mealsOnSlot(date: LocalDate, slot: MealSlot): Promise<readonly MealEntry[]> {
      const stored = await database.mealEntries
        .where('[isDeleted+date+slot]')
        .equals([ALIVE, date, slot])
        .toArray();
      return stored.map(fromStored).sort(byCreation);
    },

    async removeMeal(id: MealEntryId, at: Instant = now()): Promise<void> {
      const stored = await database.mealEntries.get(id);
      if (stored === undefined) {
        return;
      }
      await database.mealEntries.put(toStored(asDeleted(fromStored(stored), at)));
    },

    /**
     * Deshace un borrado quitando la lápida (D-042).
     *
     * No lanza si el registro no existe, por lo mismo que `removeMeal`: quien
     * deshace pulsa un botón de una pantalla que puede llevar un rato abierta, y
     * que la fila haya desaparecido por otra vía no es un fallo de programación
     * que deba tumbar nada. Resucitar algo que ya estaba vivo tampoco hace daño:
     * solo le mueve el `updatedAt`.
     */
    async restoreMeal(id: MealEntryId, at: Instant = now()): Promise<void> {
      const stored = await database.mealEntries.get(id);
      if (stored === undefined) {
        return;
      }
      await database.mealEntries.put(toStored(asRestored(fromStored(stored), at)));
    },

    async saveExercise(entry: ExerciseEntry): Promise<void> {
      await database.exerciseEntries.put(toStored(entry));
    },

    async exerciseById(id: ExerciseEntryId): Promise<ExerciseEntry | undefined> {
      const stored = await database.exerciseEntries.get(id);
      if (stored?.isDeleted !== ALIVE) {
        return undefined;
      }
      return fromStored(stored);
    },

    async exerciseOn(date: LocalDate): Promise<readonly ExerciseEntry[]> {
      const stored = await database.exerciseEntries
        .where('[isDeleted+date]')
        .equals([ALIVE, date])
        .toArray();
      return stored.map(fromStored).sort(byCreation);
    },

    async removeExercise(id: ExerciseEntryId, at: Instant = now()): Promise<void> {
      const stored = await database.exerciseEntries.get(id);
      if (stored === undefined) {
        return;
      }
      await database.exerciseEntries.put(toStored(asDeleted(fromStored(stored), at)));
    },

    /**
     * Todas las comidas, vivas o con lápida. Uso exclusivo de la exportación
     * (D-006): un borrado es información que hay que propagar en el archivo.
     * Ninguna pantalla del diario debería llamar a esto.
     */
    async allMealsIncludingDeleted(): Promise<readonly MealEntry[]> {
      const stored = await database.mealEntries.toArray();
      return stored.map(fromStored).sort(byCreation);
    },

    /** Igual que `allMealsIncludingDeleted`, para el ejercicio. Mismo uso exclusivo. */
    async allExerciseIncludingDeleted(): Promise<readonly ExerciseEntry[]> {
      const stored = await database.exerciseEntries.toArray();
      return stored.map(fromStored).sort(byCreation);
    },

    /** Los días que tienen algún registro vivo, para pintar el calendario. */
    async datesWithEntries(): Promise<readonly LocalDate[]> {
      const [meals, exercise] = await Promise.all([
        database.mealEntries.where('isDeleted').equals(ALIVE).toArray(),
        database.exerciseEntries.where('isDeleted').equals(ALIVE).toArray(),
      ]);
      const dates = new Set<LocalDate>();
      for (const entry of [...meals, ...exercise]) {
        dates.add(entry.date);
      }
      return [...dates].sort((a, b) => a.localeCompare(b));
    },
  };
}

const byCreation = (a: { createdAt: Instant }, b: { createdAt: Instant }): number =>
  a.createdAt.localeCompare(b.createdAt);

export const diaryRepository = createDiaryRepository(db);
