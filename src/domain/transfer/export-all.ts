import { db, type NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createGoalsRepository, createProfileRepository } from '@/data/repositories/settings';
import {
  EXPORT_SCHEMA_VERSION,
  type ExportEnvelope,
  type ExportPayload,
} from '@/domain/transfer/export';
import { now, type Instant } from '@/domain/time/local-date';
import { APP_VERSION } from '@/shared/lib/app-version';

/**
 * Volcar todo lo guardado a un `ExportEnvelope` (D-007).
 *
 * Lee con los métodos `...IncludingDeleted` de cada repositorio: las lápidas
 * viajan en el archivo a propósito (D-006), para que un borrado se propague
 * al importar en otro dispositivo en vez de resucitar.
 *
 * Mismo patrón de inyección de dependencias que `createSeeder`
 * (`data/seed.ts`): la base de datos entra por parámetro, así que los tests
 * usan una aparte y el resto de la aplicación usa la instancia por defecto.
 */
export function createExporter(database: NutriCalDatabase) {
  const foods = createFoodRepository(database);
  const diary = createDiaryRepository(database);
  const goals = createGoalsRepository(database);
  const profile = createProfileRepository(database);

  return {
    async exportAll(clock: () => Instant = now): Promise<ExportEnvelope> {
      const [profileData, goalVersions, allFoods, mealEntries, exerciseEntries] = await Promise.all(
        [
          profile.currentIncludingDeleted(),
          goals.allVersionsIncludingDeleted(),
          foods.allIncludingDeleted(),
          diary.allMealsIncludingDeleted(),
          diary.allExerciseIncludingDeleted(),
        ],
      );

      // `ProfileProvider` no deja arrancar la aplicación sin perfil (crea uno
      // la primera vez): o hay perfil o hay un error, nunca "todavía no". Si
      // esto se lanza, algo llamó a exportar sin pasar por ahí primero.
      if (profileData === undefined) {
        throw new Error('No hay perfil que exportar.');
      }

      const data: ExportPayload = {
        profile: profileData,
        goals: goalVersions,
        foods: allFoods,
        mealEntries,
        exerciseEntries,
      };

      return {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: clock(),
        appVersion: APP_VERSION,
        data,
      };
    },
  };
}

export const exporter = createExporter(db);
