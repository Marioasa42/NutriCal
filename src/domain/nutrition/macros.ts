import type { Grams, Kilocalories } from '@/domain/units/units';

/**
 * Macronutrientes de una cantidad concreta de alimento.
 *
 * Cuatro campos son obligatorios porque sin ellos la aplicación no puede mostrar
 * nada útil. El resto son opcionales, y su ausencia significa "la fuente no lo
 * aporta", que no es lo mismo que cero. Con `exactOptionalPropertyTypes`
 * activado, la clave falta o tiene un valor real: no se puede escribir
 * `sugars: undefined`, así que no hay dos maneras de decir lo mismo.
 */
export interface Macros {
  readonly energy: Kilocalories;
  readonly protein: Grams;
  readonly carbohydrates: Grams;
  readonly fat: Grams;
  readonly sugars?: Grams;
  readonly saturatedFat?: Grams;
  readonly fiber?: Grams;
  readonly salt?: Grams;
}

/** Cualquier clave de `Macros`, obligatoria u opcional. */
export type MacroKey = keyof Macros;

/**
 * Las claves sin las que un producto no puede convertirse en `Food`.
 *
 * `satisfies` comprueba que esta lista solo contiene claves reales de `Macros`,
 * y a la vez conserva los literales exactos, cosa que una anotación
 * `readonly MacroKey[]` perdería. Si alguien renombra `carbohydrates`, esta línea
 * deja de compilar.
 */
export const REQUIRED_MACRO_KEYS = [
  'energy',
  'protein',
  'carbohydrates',
  'fat',
] as const satisfies readonly MacroKey[];

export type RequiredMacroKey = (typeof REQUIRED_MACRO_KEYS)[number];

/**
 * Las claves que la fuente puede no aportar.
 *
 * Hace falta como lista en tiempo de ejecución, y no solo como tipo, porque la
 * suma de un día tiene que recorrerlas para contar cuántos registros no traían
 * cada una. Las cuatro son `Grams`, cosa de la que se aprovecha esa suma.
 */
export const OPTIONAL_MACRO_KEYS = [
  'sugars',
  'saturatedFat',
  'fiber',
  'salt',
] as const satisfies readonly MacroKey[];

export type OptionalMacroKey = (typeof OPTIONAL_MACRO_KEYS)[number];

/**
 * Comprobación en tiempo de compilación: la lista de arriba debe coincidir
 * exactamente con las claves obligatorias del tipo. Si añades un campo
 * obligatorio a `Macros` y olvidas la lista, este archivo deja de compilar.
 *
 * `-?` quita el modificador opcional de cada clave para poder compararlas. Una
 * clave es obligatoria cuando su versión seleccionada ya es igual a su versión
 * forzada a obligatoria.
 */
type RequiredKeysOf<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? K : never;
}[keyof T];

/** Devuelve `true` si ambas uniones tienen exactamente los mismos miembros. */
type SameMembers<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { faltanEnLaLista: Exclude<B, A> }
  : { sobranEnLaLista: Exclude<A, B> };

/** `Expect` solo acepta `true`, así que un desajuste produce un error legible. */
type Expect<T extends true> = T;

/**
 * Si esta línea da error, la lista `REQUIRED_MACRO_KEYS` y el tipo `Macros` se
 * han desincronizado. El mensaje del compilador dice qué clave falta o sobra.
 */
export type RequiredMacroKeysAreInSync = Expect<
  SameMembers<RequiredMacroKey, RequiredKeysOf<Macros>>
>;

/** Lo contrario de `RequiredKeysOf`: las claves que sí llevan el modificador. */
type OptionalKeysOf<T> = {
  [K in keyof T]-?: Pick<T, K> extends Required<Pick<T, K>> ? never : K;
}[keyof T];

/**
 * La misma red de seguridad para las opcionales. Si añades un macronutriente
 * opcional a `Macros` y olvidas la lista, este archivo deja de compilar.
 */
export type OptionalMacroKeysAreInSync = Expect<
  SameMembers<OptionalMacroKey, OptionalKeysOf<Macros>>
>;
