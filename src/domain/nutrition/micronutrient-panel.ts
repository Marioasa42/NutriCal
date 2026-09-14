import type { DayTotals } from '@/domain/diary/day';
import type { DailyGoals } from '@/domain/goals/goals';
import { referenceIntakeFor, upperLimitFor } from '@/domain/nutrition/reference-intakes';
import { MICRONUTRIENT_IDS, type MicronutrientId } from '@/domain/nutrition/micronutrients';
import type { Sex } from '@/domain/profile/profile';

/**
 * Qué mostrar de un micronutriente en el panel del día.
 *
 * Es una unión discriminada por `kind`, con dos ramas que reparten los campos
 * a propósito distinto: la rama `noData` no lleva objetivo ni porcentaje
 * porque no hay nada que comparar contra nada, y obligarla a llevarlos habría
 * significado inventar un cero. Esto es D-026 por construcción: no existe
 * ninguna forma de fabricar la rama `known` sin pasar por `unknownCount`, así
 * que un componente que la pinte no puede olvidarse de la marca porque no
 * está separada, es parte del mismo valor.
 */
export type MicronutrientRow =
  | { readonly kind: 'noData'; readonly id: MicronutrientId; readonly totalEntries: number }
  | {
      readonly kind: 'known';
      readonly id: MicronutrientId;
      readonly amount: number;
      /** Cuántos de los registros del día no aportaban este nutriente. */
      readonly unknownCount: number;
      readonly totalEntries: number;
      readonly target: number;
      /** Si el objetivo es uno fijado a mano o el valor de referencia oficial. */
      readonly targetSource: 'goal' | 'reference';
      readonly upperLimit?: number;
      readonly percentOfTarget: number;
    };

/**
 * Construye la fila de un micronutriente.
 *
 * El objetivo sale de `goals.micros[id]` si existe (D-049 no lo edita todavía
 * desde ninguna pantalla, pero el modelo ya tiene sitio) y, si no, de la tabla
 * de referencia oficial citada en `reference-intakes.ts`. `goals` puede ser
 * `undefined` -un perfil recién creado no tiene ninguna versión todavía- y en
 * ese caso el resultado es el mismo que si existiera pero no trajera ese
 * micronutriente: la referencia oficial (decisión 13).
 */
export function buildMicronutrientRow(
  id: MicronutrientId,
  totals: DayTotals,
  totalEntries: number,
  sex: Sex,
  goals: DailyGoals | undefined,
): MicronutrientRow {
  const amount = totals.micros[id];
  if (amount === undefined) {
    return { kind: 'noData', id, totalEntries };
  }

  const goalTarget = goals?.micros[id];
  const target = goalTarget ?? referenceIntakeFor(id, sex);
  const upperLimit = upperLimitFor(id);

  return {
    kind: 'known',
    id,
    amount,
    unknownCount: totals.unknown[id] ?? 0,
    totalEntries,
    target,
    targetSource: goalTarget !== undefined ? 'goal' : 'reference',
    ...(upperLimit !== undefined ? { upperLimit } : {}),
    // `target` nunca es cero: toda fila de la tabla de referencia y todo
    // objetivo válido (`isEnergyGoalAllowed` no se aplica aquí, pero nadie
    // guarda un objetivo de micronutriente a cero) es una magnitud positiva.
    percentOfTarget: (amount / target) * 100,
  };
}

/** El panel completo: una fila por cada uno de los veintidós micronutrientes, en el orden del catálogo. */
export function buildMicronutrientPanel(
  totals: DayTotals,
  totalEntries: number,
  sex: Sex,
  goals: DailyGoals | undefined,
): readonly MicronutrientRow[] {
  return MICRONUTRIENT_IDS.map((id) => buildMicronutrientRow(id, totals, totalEntries, sex, goals));
}
