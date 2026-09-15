import { db, type NutriCalDatabase } from '@/data/db';
import { ALIVE, fromStored, toStored } from '@/data/stored';
import { asDeleted } from '@/data/tombstone';
import { goalsEffectiveOn, type DailyGoals } from '@/domain/goals/goals';
import type { GoalsId } from '@/domain/identity/ids';
import type { Profile } from '@/domain/profile/profile';
import { now, type Instant, type LocalDate } from '@/domain/time/local-date';

/**
 * Objetivos diarios y perfil.
 *
 * Los objetivos no se sobrescriben: cada cambio es una versión nueva con su
 * fecha de entrada en vigor, según la decisión D-004. Este repositorio solo
 * guarda y recupera; qué versión está vigente en un día lo decide la función
 * pura del dominio, que además se puede probar sin base de datos.
 */
export function createGoalsRepository(database: NutriCalDatabase) {
  return {
    async save(goals: DailyGoals): Promise<void> {
      await database.goals.put(toStored(goals));
    },

    /** Todas las versiones vivas, de la más reciente a la más antigua. */
    async allVersions(): Promise<readonly DailyGoals[]> {
      const stored = await database.goals.where('isDeleted').equals(ALIVE).toArray();
      return stored.map(fromStored).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    },

    /**
     * Todas las versiones, vivas o con lápida. Uso exclusivo de la
     * exportación (D-006): un borrado es información que hay que propagar en
     * el archivo. Ninguna pantalla de objetivos debería llamar a esto.
     */
    async allVersionsIncludingDeleted(): Promise<readonly DailyGoals[]> {
      const stored = await database.goals.toArray();
      return stored.map(fromStored).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    },

    /** Los objetivos que regían en un día concreto, que no son los de hoy. */
    async effectiveOn(date: LocalDate): Promise<DailyGoals | undefined> {
      const stored = await database.goals.where('isDeleted').equals(ALIVE).toArray();
      return goalsEffectiveOn(stored.map(fromStored), date);
    },

    async remove(id: GoalsId, at: Instant = now()): Promise<void> {
      const stored = await database.goals.get(id);
      if (stored === undefined) {
        return;
      }
      await database.goals.put(toStored(asDeleted(fromStored(stored), at)));
    },
  };
}

/**
 * Perfil. Hay exactamente uno mientras no existan cuentas, pero se guarda en una
 * tabla con clave en lugar de en una fila fija, para que la fase 4 pueda tener
 * varios sin migrar nada.
 */
export function createProfileRepository(database: NutriCalDatabase) {
  return {
    async save(profile: Profile): Promise<void> {
      await database.profile.put(toStored(profile));
    },

    async current(): Promise<Profile | undefined> {
      const stored = await database.profile.where('isDeleted').equals(ALIVE).first();
      return stored === undefined ? undefined : fromStored(stored);
    },

    /**
     * El perfil aunque tenga lápida. Uso exclusivo de la exportación
     * (D-006). Ninguna pantalla de ajustes debería llamar a esto.
     */
    async currentIncludingDeleted(): Promise<Profile | undefined> {
      const stored = await database.profile.toArray();
      const [first] = stored;
      return first === undefined ? undefined : fromStored(first);
    },
  };
}

export const goalsRepository = createGoalsRepository(db);
export const profileRepository = createProfileRepository(db);
