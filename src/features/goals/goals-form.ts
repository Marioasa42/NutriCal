/**
 * Lectura y validación del formulario de objetivos, aparte del componente.
 *
 * Es una función pura y se prueba sin React, por el mismo motivo que
 * `off-error-messages.ts` vive separado de la pantalla que lo usa: aquí está
 * toda la lógica con casos límite (comas decimales, un campo opcional vacío,
 * energía a cero) y separarla la deja probable sin montar nada.
 */

export interface GoalsFormFields {
  readonly energy: string;
  readonly protein: string;
  readonly carbohydrates: string;
  readonly fat: string;
  readonly fiber: string;
}

export interface ParsedGoalsForm {
  readonly energy: number;
  readonly protein: number;
  readonly carbohydrates: number;
  readonly fat: number;
  readonly fiber?: number;
}

export type GoalsFormResult =
  | { readonly kind: 'valid'; readonly values: ParsedGoalsForm }
  | { readonly kind: 'invalid' };

/**
 * Un número no negativo, admitiendo coma decimal.
 *
 * Cadena vacía es "no se ha escrito nada", no cero: eso importa para `fiber`,
 * el único campo opcional, donde vacío significa "no fijar objetivo de fibra"
 * y no "fijarlo a cero".
 */
function parseNonNegative(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Valida el formulario entero.
 *
 * Las cuatro macros son obligatorias, igual que en `Macros` de D-002: sin
 * ellas no hay nada que mostrar en el diario. La energía además tiene que ser
 * mayor que cero; el suelo de seguridad (`isEnergyGoalAllowed`) se comprueba
 * aparte, porque necesita el sexo del perfil y esta función no lo conoce.
 */
export function parseGoalsForm(fields: GoalsFormFields): GoalsFormResult {
  const energy = parseNonNegative(fields.energy);
  const protein = parseNonNegative(fields.protein);
  const carbohydrates = parseNonNegative(fields.carbohydrates);
  const fat = parseNonNegative(fields.fat);

  if (
    energy === undefined ||
    energy <= 0 ||
    protein === undefined ||
    carbohydrates === undefined ||
    fat === undefined
  ) {
    return { kind: 'invalid' };
  }

  if (fields.fiber.trim() === '') {
    return { kind: 'valid', values: { energy, protein, carbohydrates, fat } };
  }

  const fiber = parseNonNegative(fields.fiber);
  if (fiber === undefined) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', values: { energy, protein, carbohydrates, fat, fiber } };
}
