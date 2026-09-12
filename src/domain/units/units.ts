import type { Brand } from '@/domain/brand';
import { invariant } from '@/shared/lib/invariant';

/**
 * Unidades canónicas del dominio.
 *
 * Regla del proyecto: dentro de la aplicación todo va en estas unidades. La
 * conversión a las unidades que prefiera la persona usuaria, como libras o
 * kilojulios, ocurre solo en la capa de presentación.
 *
 * Los micronutrientes son la excepción razonada a "todo en gramos": el hierro se
 * mide en miligramos y la B12 en microgramos. Guardarlos en gramos produciría
 * números como 0,0000024, incómodos de leer y frágiles en coma flotante. Por eso
 * miligramos y microgramos son unidades de primera clase, con su propia marca.
 */
export type Grams = Brand<number, 'Grams'>;
export type Milligrams = Brand<number, 'Milligrams'>;
export type Micrograms = Brand<number, 'Micrograms'>;
export type Milliliters = Brand<number, 'Milliliters'>;
export type Kilocalories = Brand<number, 'Kilocalories'>;
export type Minutes = Brand<number, 'Minutes'>;

/** Lo que puede medir una porción: masa o volumen, nunca energía. */
export type Quantity = Grams | Milliliters;

/** Cualquier magnitud de masa usada por un nutriente. */
export type NutrientMass = Grams | Milligrams | Micrograms;

function assertMeasurable(value: number, unit: string): void {
  invariant(Number.isFinite(value), `${unit}: se esperaba un número finito, se recibió ${value}`);
  invariant(value >= 0, `${unit}: no puede ser negativo, se recibió ${value}`);
}

/*
 * Constructores. Son el único lugar de todo el proyecto donde se usa `as` para
 * poner la marca. Concentrar la aserción aquí significa que la validación ocurre
 * una sola vez, en la frontera, y el resto del código puede confiar en el tipo.
 */

export function grams(value: number): Grams {
  assertMeasurable(value, 'grams');
  return value as Grams;
}

export function milligrams(value: number): Milligrams {
  assertMeasurable(value, 'milligrams');
  return value as Milligrams;
}

export function micrograms(value: number): Micrograms {
  assertMeasurable(value, 'micrograms');
  return value as Micrograms;
}

export function milliliters(value: number): Milliliters {
  assertMeasurable(value, 'milliliters');
  return value as Milliliters;
}

export function kilocalories(value: number): Kilocalories {
  assertMeasurable(value, 'kilocalories');
  return value as Kilocalories;
}

export function minutes(value: number): Minutes {
  assertMeasurable(value, 'minutes');
  return value as Minutes;
}

/*
 * Conversiones. No existe ninguna vía implícita entre unidades: para pasar de
 * miligramos a gramos hay que llamar a una función, y eso hace visible en el
 * código cada punto donde cambia la escala.
 */

export const milligramsToGrams = (value: Milligrams): Grams => grams(value / 1000);
export const gramsToMilligrams = (value: Grams): Milligrams => milligrams(value * 1000);
export const microgramsToMilligrams = (value: Micrograms): Milligrams => milligrams(value / 1000);
export const milligramsToMicrograms = (value: Milligrams): Micrograms => micrograms(value * 1000);
export const microgramsToGrams = (value: Micrograms): Grams => grams(value / 1_000_000);

/** Kilojulios por kilocaloría. Factor oficial usado en el etiquetado europeo. */
export const KILOJOULES_PER_KILOCALORIE = 4.184;

export const kilocaloriesToKilojoules = (value: Kilocalories): number =>
  value * KILOJOULES_PER_KILOCALORIE;

export const kilojoulesToKilocalories = (value: number): Kilocalories =>
  kilocalories(value / KILOJOULES_PER_KILOCALORIE);

/**
 * Escala una magnitud marcada por un factor sin perder la marca.
 *
 * El genérico `<M extends BrandedNumber>` dice: acepta cualquier número marcado
 * y devuelve exactamente el mismo tipo que recibiste. Si le pasas `Grams`, el
 * resultado es `Grams`, no un `number` cualquiera.
 */
export function scale<M extends Brand<number, string>>(value: M, factor: number): M {
  assertMeasurable(factor, 'factor');
  return (value * factor) as M;
}

/** Suma magnitudes de la misma unidad. El compilador impide mezclarlas. */
export function sum<M extends Brand<number, string>>(values: readonly M[], zero: M): M {
  return values.reduce<M>((total, value) => (total + value) as M, zero);
}
