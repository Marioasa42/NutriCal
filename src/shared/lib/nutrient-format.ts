import type { BaseUnit } from '@/domain/food/food';
import type { MacroKey } from '@/domain/nutrition/macros';
import type { Grams, Kilocalories, Quantity } from '@/domain/units/units';

/**
 * Nombres y formato de los nutrientes, para enseñarlos.
 *
 * Vive en `shared/lib` y no en `domain` a propósito: el dominio no sabe en qué
 * idioma se lee ni con cuántos decimales se enseña. Es la misma frontera que
 * separa las unidades canónicas de su conversión, y la misma que D-023 fijó para
 * el redondeo: el cálculo va exacto y el formato ocurre aquí, una sola vez.
 */

/** El nombre de cada macronutriente en español. */
export const MACRO_LABELS = {
  energy: 'energía',
  protein: 'proteínas',
  carbohydrates: 'hidratos de carbono',
  fat: 'grasas',
  sugars: 'azúcares',
  saturatedFat: 'grasas saturadas',
  fiber: 'fibra',
  salt: 'sal',
} as const satisfies Record<MacroKey, string>;

/**
 * `satisfies` en vez de una anotación `: Record<MacroKey, string>`. Las dos
 * comprueban que están todas las claves y ninguna de más, pero `satisfies`
 * conserva además los literales exactos, así que `MACRO_LABELS.fiber` es del
 * tipo `'fibra'` y no de un `string` cualquiera. Si mañana se añade un
 * macronutriente a `Macros`, esta línea deja de compilar hasta que tenga nombre.
 */

/** Une varios nombres con comas y una "y" al final, como se escribe en español. */
export function listMacroLabels(keys: readonly MacroKey[]): string {
  return new Intl.ListFormat('es-ES', { style: 'long', type: 'conjunction' }).format(
    keys.map((key) => MACRO_LABELS[key]),
  );
}

/**
 * Los decimales con los que se enseña cada magnitud.
 *
 * La energía sin decimales: nadie decide nada con 247,3 kcal que no decidiera
 * con 247. Los gramos con uno, porque en las macros el primer decimal sí
 * distingue, sobre todo en cantidades pequeñas donde 0,4 g de sal y 0,0 g no son
 * lo mismo.
 *
 * El redondeo ocurre aquí y solo aquí. Los totales llegan con todos sus
 * decimales desde el dominio (D-023), y esa es la razón de que sumar tres
 * registros y sumar uno partido en tres den el mismo número.
 */
const ENERGY_DIGITS = 0;
const GRAMS_DIGITS = 1;

const numberFormat = (locale: string, digits: number): Intl.NumberFormat =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: digits });

export function formatEnergy(value: Kilocalories, locale = 'es-ES'): string {
  return `${numberFormat(locale, ENERGY_DIGITS).format(value)} kcal`;
}

export function formatGrams(value: Grams, locale = 'es-ES'): string {
  return `${numberFormat(locale, GRAMS_DIGITS).format(value)} g`;
}

/**
 * Una cantidad de alimento, en la unidad base que le corresponda.
 *
 * No es lo mismo que `formatGrams` aunque se le parezca: aquí no se mide un
 * nutriente sino cuánto se comió, y la unidad la trae el alimento porque puede
 * ser masa o volumen (D-005). Los mismos decimales que los gramos, por el mismo
 * motivo: media ración de algo pequeño no puede quedarse en cero.
 *
 * Vive aquí, y no en la pantalla que lo enseña, porque D-023 y D-030 dicen que
 * el redondeo ocurre en este módulo y en ninguno más. Un `toFixed` suelto en un
 * componente sería una segunda regla de redondeo escondida.
 */
export function formatQuantity(value: Quantity, unit: BaseUnit, locale = 'es-ES'): string {
  return `${numberFormat(locale, GRAMS_DIGITS).format(value)} ${unit}`;
}
