import Dexie, { type EntityTable } from 'dexie';

import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { Food } from '@/domain/food/food';
import type { DailyGoals } from '@/domain/goals/goals';
import type { Profile } from '@/domain/profile/profile';

/**
 * Base de datos local sobre IndexedDB.
 *
 * Nota sobre los índices: IndexedDB no indexa las claves ausentes, y una entidad
 * viva no tiene `deletedAt`. Por eso el filtro de lápidas no es un índice sino un
 * predicado en la consulta, tal como anticipaba la decisión D-006. A cambio, los
 * índices que sí existen son los que de verdad acotan la búsqueda: la fecha local
 * en el diario y el código de barras en los alimentos.
 *
 * `EntityTable<T, 'id'>` declara la tabla diciendo cuál es su clave primaria, de
 * modo que TypeScript sabe que `get` recibe un `FoodId` y no una cadena
 * cualquiera.
 */
export class NutriCalDatabase extends Dexie {
  declare foods: EntityTable<Food, 'id'>;
  declare mealEntries: EntityTable<MealEntry, 'id'>;
  declare exerciseEntries: EntityTable<ExerciseEntry, 'id'>;
  declare goals: EntityTable<DailyGoals, 'id'>;
  declare profile: EntityTable<Profile, 'id'>;

  constructor(name = 'nutrical') {
    super(name);

    /*
     * Versión 1 del esquema. Este número describe la forma del almacén local y
     * sube cuando cambian las tablas o los índices. Es deliberadamente distinto
     * de EXPORT_SCHEMA_VERSION, que describe el formato del archivo exportado.
     * Ver la decisión D-007.
     *
     * Solo se listan las propiedades indexadas. El resto del objeto se guarda
     * igual, simplemente no se puede consultar por ello.
     */
    this.version(1).stores({
      foods: 'id, name, source.barcode, updatedAt',
      mealEntries: 'id, date, [date+slot], updatedAt',
      exerciseEntries: 'id, date, updatedAt',
      goals: 'id, effectiveFrom',
      profile: 'id',
    });
  }
}

/** Instancia única para la aplicación. Los tests crean la suya con otro nombre. */
export const db = new NutriCalDatabase();
