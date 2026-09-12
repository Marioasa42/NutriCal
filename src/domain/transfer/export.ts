import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { Food } from '@/domain/food/food';
import type { DailyGoals } from '@/domain/goals/goals';
import type { Profile } from '@/domain/profile/profile';
import type { Instant } from '@/domain/time/local-date';

/**
 * Versión del formato del archivo exportado.
 *
 * Es deliberadamente independiente del número de versión de Dexie. La versión de
 * Dexie describe la forma del almacén local y sube por motivos internos, como
 * añadir un índice. Esta describe un contrato con el exterior: un archivo que
 * alguien guardó hace un año y quiere volver a importar. Atarlas obligaría a
 * romper la compatibilidad de los archivos cada vez que se toca un índice.
 */
export const EXPORT_SCHEMA_VERSION = 1;

/**
 * Los datos exportados. Incluye las entidades con lápida a propósito: si no se
 * exportaran los borrados, importar un archivo antiguo resucitaría lo borrado.
 */
export interface ExportPayload {
  readonly profile: Profile;
  readonly goals: readonly DailyGoals[];
  readonly foods: readonly Food[];
  readonly mealEntries: readonly MealEntry[];
  readonly exerciseEntries: readonly ExerciseEntry[];
}

/**
 * El archivo JSON completo. La importación lee primero `schemaVersion`, aplica
 * la cadena de migraciones que haga falta y solo entonces valida con Zod.
 */
export interface ExportEnvelope {
  readonly schemaVersion: number;
  readonly exportedAt: Instant;
  /** Versión de la aplicación que generó el archivo, útil para diagnosticar. */
  readonly appVersion: string;
  readonly data: ExportPayload;
}
