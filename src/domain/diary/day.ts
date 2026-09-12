import type { ExerciseEntry } from '@/domain/diary/exercise-entry';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { DailyGoals } from '@/domain/goals/goals';
import type { MacroKey, Macros } from '@/domain/nutrition/macros';
import type { MicronutrientId, Micronutrients } from '@/domain/nutrition/micronutrients';
import type { LocalDate } from '@/domain/time/local-date';
import type { Kilocalories } from '@/domain/units/units';

/** Cualquier nutriente, macro o micro, identificado por su clave. */
export type NutrientKey = MacroKey | MicronutrientId;

/**
 * Cuántos registros del día no aportaban cada nutriente.
 *
 * Es la consecuencia práctica de tratar la ausencia como "no se sabe": si tres
 * de tus cinco comidas no traían datos de hierro, el total de hierro no es un
 * número fiable y la interfaz tiene que poder decirlo en lugar de sumar ceros.
 */
export type UnknownNutrientCounts = Readonly<Partial<Record<NutrientKey, number>>>;

export interface DayTotals {
  readonly macros: Macros;
  readonly micros: Micronutrients;
  readonly energyBurned: Kilocalories;
  readonly unknown: UnknownNutrientCounts;
}

/**
 * El resumen de un día.
 *
 * No es una fila guardada en ninguna tabla: es una proyección que se calcula
 * agrupando los registros por su fecha local. Guardarlo crearía una segunda
 * fuente de verdad que habría que mantener sincronizada con los registros.
 */
export interface DaySummary {
  readonly date: LocalDate;
  readonly meals: readonly MealEntry[];
  readonly exercise: readonly ExerciseEntry[];
  readonly totals: DayTotals;
  /** Los objetivos vigentes ese día, no los objetivos actuales. */
  readonly goals: DailyGoals;
}
