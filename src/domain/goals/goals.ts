import type { GoalsId } from '@/domain/identity/ids';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import type { Persisted } from '@/domain/persistence/persisted';
import type { LocalDate } from '@/domain/time/local-date';
import { kilocalories, type Grams, type Kilocalories } from '@/domain/units/units';

/** Cómo se fijó el objetivo: a mano o a partir de una fórmula, siempre editable. */
export type GoalOrigin =
  { readonly kind: 'manual' } | { readonly kind: 'suggested'; readonly formula: 'mifflin-st-jeor' };

/**
 * Objetivos diarios, versionados por fecha de entrada en vigor.
 *
 * El objetivo vigente para un día es el registro más reciente cuyo
 * `effectiveFrom` sea menor o igual a ese día. Así, subir hoy tu objetivo de
 * calorías no reescribe si lo cumpliste o no en marzo.
 */
export interface DailyGoals extends Persisted {
  readonly id: GoalsId;
  readonly effectiveFrom: LocalDate;
  readonly energy: Kilocalories;
  readonly protein: Grams;
  readonly carbohydrates: Grams;
  readonly fat: Grams;
  readonly fiber?: Grams;
  readonly micros: Micronutrients;
  readonly origin: GoalOrigin;
}

/**
 * Suelo del objetivo de calorías.
 *
 * Requisito de salud del proyecto: la aplicación no debe permitir fijarse
 * objetivos arbitrariamente bajos ni premiar comer menos. Este valor es un
 * límite conservador provisional; en la fase 2, cuando entren las referencias
 * oficiales, se revisará con su fuente citada.
 */
export const MIN_ENERGY_GOAL = kilocalories(1200);

/** Un objetivo de energía es aceptable si no baja del suelo. */
export const isEnergyGoalAllowed = (value: Kilocalories): boolean => value >= MIN_ENERGY_GOAL;

/**
 * Los objetivos vigentes en una fecha, dada la lista ordenable de versiones.
 *
 * Devuelve `undefined` si no hay ninguna versión anterior a esa fecha, que es lo
 * que ocurre al mirar un día previo a la creación del perfil.
 */
export function goalsEffectiveOn(
  versions: readonly DailyGoals[],
  date: LocalDate,
): DailyGoals | undefined {
  return versions
    .filter((goals) => goals.deletedAt === undefined && goals.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    .at(0);
}
