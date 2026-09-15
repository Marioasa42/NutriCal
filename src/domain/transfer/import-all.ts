import {
  db,
  type NutriCalDatabase,
  type StoredExerciseEntry,
  type StoredGoals,
  type StoredMealEntry,
  type StoredProfile,
} from '@/data/db';
import { toStored, toStoredFood, type Stored, type StoredFood } from '@/data/stored';
import type { Persisted } from '@/domain/persistence/persisted';
import type { ExportEnvelope } from '@/domain/transfer/export';

/**
 * Escribir un `ExportEnvelope` ya validado (`import-schema.ts`) en Dexie.
 *
 * Dos reglas gobiernan este archivo:
 *
 * 1. **Fusión por id, gana lo más reciente** (D-052 aplicado aquí): para cada
 *    fila del archivo, si no existe se inserta; si existe, se compara
 *    `updatedAt` y solo se escribe si la del archivo es más nueva. Importar
 *    el mismo archivo dos veces no duplica ni pisa nada, y una fila local más
 *    nueva que la del archivo nunca se pierde.
 * 2. **Una única transacción de Dexie.** `importAll` envuelve las cinco
 *    tablas en una sola `database.transaction('rw', ...)`: si algo falla a
 *    mitad (una fila que Dexie rechaza, un fallo de IndexedDB), la
 *    transacción entera se deshace y no queda ninguna fila a medio escribir.
 *    `preview` hace la misma comparación SIN escribir, para que la pantalla
 *    pueda enseñar un resumen ("se actualizarán 3 registros con datos más
 *    recientes") y pedir confirmación antes de la escritura de verdad.
 */

export interface ImportSummary {
  readonly inserted: number;
  readonly updated: number;
  readonly keptLocal: number;
}

const EMPTY_SUMMARY: ImportSummary = { inserted: 0, updated: 0, keptLocal: 0 };

function combineSummaries(a: ImportSummary, b: ImportSummary): ImportSummary {
  return {
    inserted: a.inserted + b.inserted,
    updated: a.updated + b.updated,
    keptLocal: a.keptLocal + b.keptLocal,
  };
}

type MergeDecision = 'insert' | 'update' | 'keepLocal';

function decide(existing: Persisted | undefined, incoming: Persisted): MergeDecision {
  if (existing === undefined) {
    return 'insert';
  }
  return existing.updatedAt.localeCompare(incoming.updatedAt) < 0 ? 'update' : 'keepLocal';
}

/**
 * Lo mínimo que `mergeRows` necesita de una tabla de Dexie.
 *
 * Una `EntityTable<T, 'id'>` de verdad exige que la clave de `get` sea
 * exactamente el tipo marcado de `T['id']` (`FoodId`, `MealEntryId`...), y
 * eso convertiría esta función en cinco funciones casi iguales, una por
 * marca de identificador, para poder compartir una sola. Esta interfaz local
 * solo pide un `string` -razonable, porque de todas formas es lo único que
 * IndexedDB ve por debajo-, y como es una firma de método (no una propiedad
 * con forma de función), TypeScript compara sus parámetros sin la
 * variancia estricta que le aplicaría a una propiedad: la tabla real, más
 * concreta, sigue encajando aquí sin ningún cast.
 */
interface MergeableTable<T> {
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<unknown>;
}

/**
 * Fusiona una tabla entera. `write` en `false` es exactamente `preview`: hace
 * las mismas lecturas y las mismas comparaciones, solo que no llama a `put`.
 */
async function mergeRows<T extends Stored<Persisted> & { readonly id: string }>(
  table: MergeableTable<T>,
  rows: readonly T[],
  write: boolean,
): Promise<ImportSummary> {
  let summary = EMPTY_SUMMARY;

  for (const row of rows) {
    const existing = await table.get(row.id);
    const decision = decide(existing, row);
    summary = combineSummaries(summary, {
      inserted: decision === 'insert' ? 1 : 0,
      updated: decision === 'update' ? 1 : 0,
      keptLocal: decision === 'keepLocal' ? 1 : 0,
    });
    if (write && decision !== 'keepLocal') {
      await table.put(row);
    }
  }

  return summary;
}

export function createImporter(database: NutriCalDatabase) {
  async function mergeAll(envelope: ExportEnvelope, write: boolean): Promise<ImportSummary> {
    const { data } = envelope;

    const summaries = await Promise.all([
      mergeRows<StoredProfile>(database.profile, [toStored(data.profile)], write),
      mergeRows<StoredGoals>(database.goals, data.goals.map(toStored), write),
      mergeRows<StoredFood>(database.foods, data.foods.map(toStoredFood), write),
      mergeRows<StoredMealEntry>(database.mealEntries, data.mealEntries.map(toStored), write),
      mergeRows<StoredExerciseEntry>(
        database.exerciseEntries,
        data.exerciseEntries.map(toStored),
        write,
      ),
    ]);

    return summaries.reduce(combineSummaries, EMPTY_SUMMARY);
  }

  return {
    /** Sin escribir nada. Para decidir si hace falta pedir confirmación antes de importar de verdad. */
    async preview(envelope: ExportEnvelope): Promise<ImportSummary> {
      return mergeAll(envelope, false);
    },

    /** La importación de verdad, en una única transacción (ver el comentario del archivo). */
    async importAll(envelope: ExportEnvelope): Promise<ImportSummary> {
      return database.transaction(
        'rw',
        [
          database.profile,
          database.goals,
          database.foods,
          database.mealEntries,
          database.exerciseEntries,
        ],
        () => mergeAll(envelope, true),
      );
    },
  };
}

export const importer = createImporter(db);
