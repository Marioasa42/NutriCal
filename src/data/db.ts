import Dexie, { type EntityTable } from 'dexie';

import type { Stored, StoredFood } from '@/data/stored';
import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { DailyGoals } from '@/domain/goals/goals';
import type { Profile } from '@/domain/profile/profile';

export type StoredMealEntry = Stored<MealEntry>;
export type StoredExerciseEntry = Stored<ExerciseEntry>;
export type StoredGoals = Stored<DailyGoals>;
export type StoredProfile = Stored<Profile>;

/**
 * Base de datos local sobre IndexedDB.
 *
 * Todos los índices de consulta empiezan por `isDeleted`, el campo siempre
 * presente que sustituye al ausente `deletedAt` a efectos de indexación. Así
 * excluir los registros borrados deja de ser un filtro en memoria posterior a la
 * lectura y pasa a formar parte de la propia consulta: las filas con lápida ni
 * siquiera se leen. El motivo completo está en la decisión D-014.
 *
 * `EntityTable<T, 'id'>` declara la tabla diciendo cuál es su clave primaria, de
 * modo que TypeScript sabe que `get` recibe el identificador correcto y no una
 * cadena cualquiera.
 */
export class NutriCalDatabase extends Dexie {
  declare foods: EntityTable<StoredFood, 'id'>;
  declare mealEntries: EntityTable<StoredMealEntry, 'id'>;
  declare exerciseEntries: EntityTable<StoredExerciseEntry, 'id'>;
  declare goals: EntityTable<StoredGoals, 'id'>;
  declare profile: EntityTable<StoredProfile, 'id'>;

  constructor(name = 'nutrical') {
    super(name);

    /*
     * Versión 1 del esquema. Este número describe la forma del almacén local y
     * es deliberadamente distinto de EXPORT_SCHEMA_VERSION, que describe el
     * formato del archivo exportado. Ver la decisión D-007.
     *
     * REGLA: desde el momento en que esto llegue a producción, esta versión
     * queda congelada. Cualquier cambio de esquema posterior exige una versión
     * nueva con su migración, nunca editar la línea existente. Ver D-015.
     *
     * Solo se listan las propiedades indexadas. El resto del objeto se guarda
     * igual, simplemente no se puede consultar por ello.
     */
    this.version(1).stores({
      foods: 'id, isDeleted, [isDeleted+source.barcode], [isDeleted+searchText], updatedAt',
      mealEntries: 'id, isDeleted, [isDeleted+date], [isDeleted+date+slot], updatedAt',
      exerciseEntries: 'id, isDeleted, [isDeleted+date], updatedAt',
      goals: 'id, isDeleted, [isDeleted+effectiveFrom]',
      profile: 'id, isDeleted',
    });

    /**
     * Versión 2: añade el índice que le faltaba a `source.fdcId`.
     *
     * D-015 dice que la versión 1 queda congelada y cualquier cambio de
     * esquema entra como una versión nueva, nunca editando la línea existente.
     * No hace falta una función `.upgrade()`: no se transforma ningún dato,
     * solo se indexa un campo que ya existía en todos los alimentos de fuente
     * USDA desde D-047. Dexie construye el índice solo, leyendo las filas que
     * ya hay.
     */
    this.version(2).stores({
      foods:
        'id, isDeleted, [isDeleted+source.barcode], [isDeleted+source.fdcId], [isDeleted+searchText], updatedAt',
    });
  }
}

/** Instancia única para la aplicación. Los tests crean la suya con otro nombre. */
export const db = new NutriCalDatabase();
