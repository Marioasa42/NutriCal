import type { GoalsId } from '@/domain/identity/ids';
import type { Micronutrients } from '@/domain/nutrition/micronutrients';
import type { Persisted } from '@/domain/persistence/persisted';
import type { Sex } from '@/domain/profile/profile';
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
 * Suelo del objetivo de calorías cuando no se declara el sexo, o cuando se
 * declara femenino. Requisito de salud del proyecto: la aplicación no debe
 * permitir fijarse objetivos arbitrariamente bajos ni premiar comer menos.
 *
 * ## Una cifra distinta de las demás, y hay que decirlo
 *
 * A diferencia de los valores de referencia de micronutrientes de
 * `reference-intakes.ts`, que citan una fila concreta de una tabla oficial de
 * la National Academies, **esto no existe como tabla**. Las Dietary Reference
 * Intakes no fijan un "mínimo de seguridad" de calorías: el requerimiento
 * energético (EER) es una fórmula que depende de edad, peso, talla y
 * actividad, no un número único por grupo del que se pueda tomar un suelo.
 *
 * Lo más cercano a una cifra oficial citable es el límite clínico de las
 * dietas de muy pocas calorías: por debajo de 800 kcal/día se consideran
 * "very low-calorie diets" (VLCD) y la literatura del NIH National Task Force
 * on the Prevention and Treatment of Obesity exige supervisión médica por el
 * riesgo de desequilibrios electrolíticos y otras complicaciones. El NHS
 * británico sitúa 800–1200 kcal/día como "dieta baja en calorías", ya en
 * terreno que pide cautela, no como un valor cómodo.
 *
 * 1200 kcal (aquí) y 1500 kcal para hombre (`minEnergyGoalFor`) son la
 * convención clínica y dietética más citada por encima de ese umbral, y es
 * exactamente eso: una convención de práctica, no una cifra con el respaldo de
 * una tabla RDA/AI. Se documenta así a propósito, para no hacerla pasar por
 * algo que no es (D-046).
 */
export const MIN_ENERGY_GOAL = kilocalories(1200);

/**
 * El suelo de calorías según el sexo declarado. Ver el comentario de
 * `MIN_ENERGY_GOAL` sobre de dónde sale de verdad esta cifra.
 */
export function minEnergyGoalFor(sex: Sex): Kilocalories {
  return sex === 'male' ? kilocalories(1500) : MIN_ENERGY_GOAL;
}

/**
 * Un objetivo de energía es aceptable si no baja del suelo que le corresponde.
 *
 * Sin sexo declarado, el suelo es el más BAJO de los dos (1200, no 1500), y es
 * al revés que en `referenceIntakeFor`: allí, ante la duda, más vale sugerir de
 * más. Aquí un suelo es un límite que **impide** guardar un objetivo, así que
 * ante la duda tiene que ser el menos restrictivo: subirlo a 1500 sin saber el
 * sexo bloquearía a cualquier mujer que no lo haya declarado con un límite
 * pensado para hombres, que es el error de seguridad contrario al que se
 * quiere evitar.
 */
export const isEnergyGoalAllowed = (value: Kilocalories, sex: Sex = 'unspecified'): boolean =>
  value >= minEnergyGoalFor(sex);

/**
 * Los objetivos vigentes en una fecha, dada la lista ordenable de versiones.
 *
 * Devuelve `undefined` si no hay ninguna versión anterior a esa fecha, que es lo
 * que ocurre al mirar un día previo a la creación del perfil.
 *
 * ## El desempate por `updatedAt`, y por qué hace falta
 *
 * Editar los objetivos dos veces el mismo día crea dos versiones con el mismo
 * `effectiveFrom`, porque D-004 no versiona por instante, versiona por día. Sin
 * un segundo criterio de orden, el resultado ante un empate depende de en qué
 * orden `Array.prototype.sort` recibiera las dos filas, y eso a su vez depende
 * del orden en que Dexie las devuelve, que no es un contrato: puede ser el de
 * inserción hoy y dejar de serlo mañana. Quien edita un objetivo dos veces
 * seguidas espera que gane la segunda edición, no una casualidad del
 * almacenamiento.
 *
 * `localeCompare` funciona aquí porque `effectiveFrom` (YYYY-MM-DD) y
 * `updatedAt` (ISO 8601) son los dos formatos donde el orden alfabético
 * coincide con el orden cronológico.
 */
export function goalsEffectiveOn(
  versions: readonly DailyGoals[],
  date: LocalDate,
): DailyGoals | undefined {
  return versions
    .filter((goals) => goals.deletedAt === undefined && goals.effectiveFrom <= date)
    .sort(
      (a, b) =>
        b.effectiveFrom.localeCompare(a.effectiveFrom) || b.updatedAt.localeCompare(a.updatedAt),
    )
    .at(0);
}
