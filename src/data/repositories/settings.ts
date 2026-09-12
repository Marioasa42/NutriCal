import { db, type NutriCalDatabase } from '@/data/db';
import { asDeleted } from '@/data/tombstone';
import { goalsEffectiveOn, type DailyGoals } from '@/domain/goals/goals';
import type { GoalsId } from '@/domain/identity/ids';
import { isAlive } from '@/domain/persistence/persisted';
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
      await database.goals.put(goals);
    },

    /** Todas las versiones vivas, de la más reciente a la más antigua. */
    async allVersions(): Promise<readonly DailyGoals[]> {
      const versions = await database.goals.toArray();
      return versions
        .filter(isAlive)
        .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    },

    /** Los objetivos que regían en un día concreto, que no son los de hoy. */
    async effectiveOn(date: LocalDate): Promise<DailyGoals | undefined> {
      const versions = await database.goals.toArray();
      return goalsEffectiveOn(versions, date);
    },

    async remove(id: GoalsId, at: Instant = now()): Promise<void> {
      const goals = await database.goals.get(id);
      if (goals === undefined) {
        return;
      }
      await database.goals.put(asDeleted(goals, at));
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
      await database.profile.put(profile);
    },

    async current(): Promise<Profile | undefined> {
      const profiles = await database.profile.toArray();
      return profiles.find(isAlive);
    },
  };
}

export const goalsRepository = createGoalsRepository(db);
export const profileRepository = createProfileRepository(db);
