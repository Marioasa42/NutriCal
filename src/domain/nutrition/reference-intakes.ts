import type { MicronutrientAmount } from '@/domain/nutrition/build-micronutrients';
import type { MicronutrientId } from '@/domain/nutrition/micronutrients';
import type { Sex } from '@/domain/profile/profile';
import { micrograms, milligrams } from '@/domain/units/units';

/**
 * Valores de referencia diarios de micronutrientes, de una fuente oficial y
 * citada, tal y como pide CLAUDE.md. Nada de esto está inventado ni copiado de
 * un blog: cada cifra es la que aparece, literal, en la tabla resumen oficial de
 * las Dietary Reference Intakes (DRI) de la National Academies de EE. UU., que
 * es la misma tabla que cita el NIH Office of Dietary Supplements (ODS) como su
 * fuente primaria.
 *
 * ## De dónde salen exactamente estas cifras
 *
 * - **Fuente**: National Academies of Sciences, Engineering, and Medicine.
 *   *Dietary Reference Intakes for Sodium and Potassium* (2019), Apéndice J,
 *   "Dietary Reference Intakes Summary Tables". Ese apéndice reúne, en una sola
 *   tabla, los resultados de todos los informes DRI anteriores (1997, 1998,
 *   2000, 2001, 2011), así que es la tabla más reciente y completa disponible.
 * - **URL**: https://www.ncbi.nlm.nih.gov/books/NBK545442/ (mirror oficial del
 *   NIH en NCBI Bookshelf; consultado el 2026-09-14).
 * - **Grupo de edad**: "Adults, 19–30 y", no gestantes ni lactantes. Es una
 *   fila concreta y única de la tabla, elegida porque D-044 decidió NO pedir la
 *   edad todavía (solo el sexo), así que hacía falta fijar una sola fila y no
 *   promediar ni mezclar dos. Para 21 de los 22 nutrientes, esta franja da
 *   exactamente lo mismo que "31–50 y"; la única diferencia es el magnesio
 *   (ver su comentario más abajo).
 *
 * `female` y `male` son la RDA (Recommended Dietary Allowance) cuando existe, o
 * si no la hay, la AI (Adequate Intake, un escalón por debajo en certeza
 * porque no hay datos para calcular un requerimiento medio). La tabla fuente
 * distingue las dos en negrita/asterisco; aquí no se distingue por tipo porque
 * el proyecto no necesita saber cuál es cuál para mostrar un objetivo, solo
 * para citarlo, y la cita ya lo dice.
 *
 * `upperLimit` es el Tolerable Upper Intake Level (UL): la cifra por encima de
 * la cual ya no es "puedes tomar más si quieres" sino "conviene no pasarse".
 * Ausente cuando la propia tabla dice "ND" (No Determinable): no es que no se
 * haya buscado el dato, es que la ciencia no tiene base suficiente para fijar
 * un límite, y siete de los veintidós no lo tienen (D-045).
 *
 * ## Por qué esto NO es "editable por el usuario" en este archivo
 *
 * La editabilidad que pide CLAUDE.md ("son editables") vive en la capa de
 * `DailyGoals` (`domain/goals/goals.ts`), no aquí: una persona puede fijar su
 * propio objetivo de hierro en 20 mg si quiere, y ese objetivo, versionado por
 * fecha, es lo que se guarda y se compara con lo que come. Este archivo es solo
 * el punto de partida con el que se sugiere cada objetivo antes de tocarlo, y
 * su valor no cambia nunca sin cambiar el código y la cita que lo sostiene.
 */
export interface ReferenceIntake {
  readonly female: MicronutrientAmount;
  readonly male: MicronutrientAmount;
  readonly upperLimit?: MicronutrientAmount;
}

export const REFERENCE_INTAKE_SOURCE = {
  organization: 'National Academies of Sciences, Engineering, and Medicine (EE. UU.)',
  report: 'Dietary Reference Intakes for Sodium and Potassium (2019), Apéndice J',
  url: 'https://www.ncbi.nlm.nih.gov/books/NBK545442/',
  ageGroup: 'Adultos de 19 a 30 años ("Adults, 19–30 y"), no gestantes ni lactantes',
  retrievedOn: '2026-09-14',
} as const;

/** El orden de las claves sigue el de `MICRONUTRIENT_IDS`, no el alfabético. */
export const MICRONUTRIENT_REFERENCE_INTAKES: Record<MicronutrientId, ReferenceIntake> = {
  vitaminA: { female: micrograms(700), male: micrograms(900), upperLimit: micrograms(3000) },
  vitaminC: { female: milligrams(75), male: milligrams(90), upperLimit: milligrams(2000) },
  vitaminD: { female: micrograms(15), male: micrograms(15), upperLimit: micrograms(100) },
  vitaminE: { female: milligrams(15), male: milligrams(15), upperLimit: milligrams(1000) },
  // Sin UL: la tabla fuente dice "ND" por falta de datos suficientes (D-045).
  vitaminK: { female: micrograms(90), male: micrograms(120) },
  thiamin: { female: milligrams(1.1), male: milligrams(1.2) },
  riboflavin: { female: milligrams(1.1), male: milligrams(1.3) },
  niacin: { female: milligrams(14), male: milligrams(16), upperLimit: milligrams(35) },
  vitaminB6: { female: milligrams(1.3), male: milligrams(1.3), upperLimit: milligrams(100) },
  folate: { female: micrograms(400), male: micrograms(400), upperLimit: micrograms(1000) },
  vitaminB12: { female: micrograms(2.4), male: micrograms(2.4) },
  calcium: { female: milligrams(1000), male: milligrams(1000), upperLimit: milligrams(2500) },
  iron: { female: milligrams(18), male: milligrams(8), upperLimit: milligrams(45) },
  /*
   * El único nutriente en el que "19–30 y" y "31–50 y" no coinciden: la tabla
   * fuente da 310/400 mg (mujer/hombre) para 19–30 y, y 320/420 mg para 31–50 y.
   * Se usa la fila de 19–30 y por la misma razón que el resto: es la fila fijada
   * en la cabecera de este archivo, y siete filas iguales más una distinta no
   * justifican romper la regla de "una sola fila para todo".
   *
   * El límite superior, además, es distinto de los demás: la tabla fuente dice
   * expresamente que el UL del magnesio "representa la ingesta de un agente
   * farmacológico únicamente y no incluye la ingesta de alimentos y agua". No
   * es un techo total como el del resto; es un techo solo para suplementos.
   */
  magnesium: { female: milligrams(310), male: milligrams(400), upperLimit: milligrams(350) },
  phosphorus: { female: milligrams(700), male: milligrams(700), upperLimit: milligrams(4000) },
  // Sin UL: no determinable (ND). Son AI, no RDA: no hay suficientes datos para
  // fijar un requerimiento medio, así que tampoco los hay para fijar un techo.
  potassium: { female: milligrams(2600), male: milligrams(3400) },
  /*
   * El caso especial de todo el catálogo. El sodio no tiene UL en el sentido
   * clásico ("ND" en la tabla de límites superiores): en su lugar, el informe
   * de 2019 introdujo la Chronic Disease Risk Reduction Intake (CDRR), un techo
   * pensado para reducir el riesgo de enfermedad crónica y no para evitar
   * toxicidad aguda. Para adultos de 19 años en adelante son 2 300 mg/día,
   * "reduce la ingesta si la superas". Se usa aquí como `upperLimit` porque es
   * el número que cumple la misma función en la interfaz —el aviso de "te has
   * pasado"—, aunque su origen científico sea distinto del resto. `female` y
   * `male` son la AI (1 500 mg), no un mínimo de seguridad: son la cantidad que
   * cubre la necesidad fisiológica, muy por debajo de lo que se come en la
   * práctica.
   */
  sodium: { female: milligrams(1500), male: milligrams(1500), upperLimit: milligrams(2300) },
  zinc: { female: milligrams(8), male: milligrams(11), upperLimit: milligrams(40) },
  copper: { female: milligrams(0.9), male: milligrams(0.9), upperLimit: milligrams(10) },
  selenium: { female: micrograms(55), male: micrograms(55), upperLimit: micrograms(400) },
  iodine: { female: micrograms(150), male: micrograms(150), upperLimit: micrograms(1100) },
  // AI, no RDA; y sin UL clásico, aunque la tabla sí da 11 mg/día como techo.
  manganese: { female: milligrams(1.8), male: milligrams(2.3), upperLimit: milligrams(11) },
};

/**
 * El valor de referencia de un micronutriente para un sexo dado.
 *
 * `unspecified` toma el **mayor** de los dos (D-044): nadie está obligado a
 * declarar su sexo, y ante esa falta de dato el error prudente es sugerir de
 * más y no de menos. Un objetivo de referencia inflado dice como mucho "te
 * falta esto" cuando no te falta; uno deflactado puede decir "vas bien" cuando
 * no es cierto, y el requisito de salud del proyecto pide equivocarse hacia el
 * primer lado, no hacia el segundo.
 */
export function referenceIntakeFor(id: MicronutrientId, sex: Sex): MicronutrientAmount {
  const { female, male } = MICRONUTRIENT_REFERENCE_INTAKES[id];
  if (sex === 'female') {
    return female;
  }
  if (sex === 'male') {
    return male;
  }
  return female >= male ? female : male;
}

/**
 * El límite superior tolerable de un micronutriente, si existe.
 *
 * No recibe el sexo, a diferencia de `referenceIntakeFor`: en las 22 filas de
 * la tabla fuente, el UL de un nutriente nunca distingue entre hombre y mujer
 * adultos, solo la RDA o la AI lo hacen. Añadir el parámetro habría sido
 * complicar la firma por una distinción que los datos no tienen.
 *
 * `undefined` cuando la fuente dice "ND" (No Determinable): no hay base
 * científica para fijar uno, y no fijar nada es más honesto que inventar un
 * número (D-045).
 */
export function upperLimitFor(id: MicronutrientId): MicronutrientAmount | undefined {
  return MICRONUTRIENT_REFERENCE_INTAKES[id].upperLimit;
}

/**
 * Comprobación en tiempo de compilación: el catálogo cubre exactamente los 22
 * micronutrientes de `MICRONUTRIENTS`, ni uno menos ni uno de más. Mismo
 * patrón que ya usa `macros.ts` para sus listas de claves obligatorias y
 * opcionales: si alguien añade una vitamina al catálogo y se olvida de citar su
 * valor de referencia aquí, este archivo deja de compilar en lugar de servir un
 * "sin datos" silencioso en el panel de la fase 2.
 */
type Expect<T extends true> = T;
type SameMembers<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { faltanEnElCatalogoDeReferencia: Exclude<B, A> }
  : { sobranEnElCatalogoDeReferencia: Exclude<A, B> };

export type ReferenceIntakesAreInSync = Expect<
  SameMembers<MicronutrientId, keyof typeof MICRONUTRIENT_REFERENCE_INTAKES>
>;
