import type { OffNutriments } from '@/services/off/schemas';
import { grams, kilocalories, kilojoulesToKilocalories } from '@/domain/units/units';
import type { Grams, Kilocalories } from '@/domain/units/units';

/**
 * Lectura de un nutriente de Open Food Facts.
 *
 * Este archivo existe por un motivo muy concreto: distinguir el nutriente que la
 * fuente no aporta del nutriente que vale cero de verdad. Son dos hechos
 * distintos sobre el mundo y la decisión D-001 exige que se representen distinto.
 *
 * La trampa está en que casi todas las formas cómodas de escribir esto los
 * confunden. `valor || undefined` convierte un cero real en desconocido.
 * `Number(valor) || 0` convierte un desconocido en cero. `Number('')` vale cero,
 * así que una cadena vacía, que es la manera que tiene OFF de decir "no lo sé",
 * se volvería un cero perfecto. Nada de eso pasa aquí porque ninguna de esas
 * formas se usa: la decisión es explícita y la toma una sola función.
 */

/**
 * El resultado de leer un nutriente, como unión discriminada de TRES ramas.
 *
 * Una unión discriminada es un conjunto de formas alternativas que comparten un
 * campo literal, aquí `kind`, y al comprobar ese campo TypeScript sabe qué otros
 * campos existen. Dentro de un `if (read.kind === 'value')` puedes leer
 * `read.value`, y fuera de él no compila.
 *
 * Tres ramas y no dos porque `"N/A"`, `-3` y `NaN` no son lo mismo que una clave
 * ausente: la fuente sí dijo algo, solo que algo inservible. En el dominio ambos
 * casos acaban igual, con la clave omitida, pero separarlos permite que un test
 * demuestre que el dato se descartó a propósito y no por accidente, y deja la
 * puerta abierta a avisar de que la fuente traía basura.
 */
export type NutrientRead =
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unusable'; readonly raw: unknown };

const ABSENT: NutrientRead = { kind: 'absent' };

/**
 * Una cadena que representa un número decimal, y nada más.
 *
 * Se compara contra esta expresión en lugar de llamar a `Number`, porque `Number`
 * acepta cosas que aquí no queremos: `Number('')` y `Number('  ')` valen cero, y
 * `Number('0x10')` vale dieciséis. La coma decimal sí se admite porque Open Food
 * Facts la usa: los datos los teclean personas de toda Europa.
 */
const DECIMAL = /^-?\d+(?:[.,]\d+)?$/;

/**
 * Interpreta un valor crudo del diccionario de nutrientes.
 *
 * El orden de las comprobaciones es lo que hace que funcione: la cadena vacía se
 * resuelve antes de intentar convertirla a número, y el cero nunca pasa por una
 * comprobación de veracidad.
 */
export function parseNutrientValue(raw: unknown): NutrientRead {
  // Clave ausente del diccionario, o presente con el nulo de OFF. Las dos cosas
  // significan lo mismo: la fuente no lo aporta.
  if (raw === undefined || raw === null) {
    return ABSENT;
  }

  if (typeof raw === 'number') {
    // `NaN` e `Infinity` son números para `typeof`, pero no son medidas.
    if (!Number.isFinite(raw) || raw < 0) {
      return { kind: 'unusable', raw };
    }
    return { kind: 'value', value: raw };
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Cadena vacía: la fuente dejó el campo en blanco. Es un desconocido, no un
    // cero, por mucho que `Number('')` opine lo contrario.
    if (trimmed === '') {
      return ABSENT;
    }
    if (!DECIMAL.test(trimmed)) {
      return { kind: 'unusable', raw };
    }
    const value = Number(trimmed.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) {
      return { kind: 'unusable', raw };
    }
    return { kind: 'value', value };
  }

  // Booleanos, objetos, listas: la fuente dijo algo que no es una medida.
  return { kind: 'unusable', raw };
}

/** Lee una clave concreta del diccionario de nutrientes. */
export function readNutrient(
  nutriments: OffNutriments | null | undefined,
  key: string,
): NutrientRead {
  if (nutriments === null || nutriments === undefined) {
    return ABSENT;
  }
  return parseNutrientValue(nutriments[key]);
}

/**
 * Puente al dominio: solo la rama `value` produce una magnitud.
 *
 * Devolver `undefined` en los otros dos casos es lo que permite el patrón de
 * propagación condicional al construir `Macros`, y con
 * `exactOptionalPropertyTypes` activado ese `undefined` nunca llega a escribirse
 * como valor de la clave: o la clave está con un número, o no está.
 */
export const gramsOf = (read: NutrientRead): Grams | undefined =>
  read.kind === 'value' ? grams(read.value) : undefined;

/**
 * Energía en kilocalorías, que es la unidad canónica del proyecto.
 *
 * Se prueban tres claves en orden. La primera que dé un valor gana, y aquí es
 * donde el cero importa de verdad: el agua del fixture trae
 * `energy-kcal_100g: 0`, y ese cero tiene que ganar en lugar de dejar pasar a la
 * siguiente clave. Por eso la condición es `kind === 'value'` y no una
 * comprobación de veracidad del número.
 *
 * La conversión desde kilojulios es legítima porque es la misma magnitud física
 * en otra escala, no un dato inventado: muchos productos europeos solo declaran
 * kJ y sin esto caerían a borrador teniendo la energía delante.
 */
export function readEnergyKcal(
  nutriments: OffNutriments | null | undefined,
): Kilocalories | undefined {
  const kcal = readNutrient(nutriments, 'energy-kcal_100g');
  if (kcal.kind === 'value') {
    return kilocalories(kcal.value);
  }

  const kj = readNutrient(nutriments, 'energy-kj_100g');
  if (kj.kind === 'value') {
    return kilojoulesToKilocalories(kj.value);
  }

  // `energy_100g` es ambiguo por sí solo: su unidad la declara `energy_unit`. Se
  // usa solo si esa unidad se entiende, porque deducirla sería adivinar, y una
  // energía adivinada es peor que una energía que se pide a mano.
  const generic = readNutrient(nutriments, 'energy_100g');
  if (generic.kind === 'value') {
    const rawUnit = nutriments?.energy_unit;
    const unit = typeof rawUnit === 'string' ? rawUnit.trim().toLowerCase() : '';
    if (unit === 'kj') {
      return kilojoulesToKilocalories(generic.value);
    }
    if (unit === 'kcal') {
      return kilocalories(generic.value);
    }
  }

  return undefined;
}
