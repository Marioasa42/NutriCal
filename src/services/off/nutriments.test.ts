import { describe, expect, it } from 'vitest';

import {
  gramsOf,
  parseNutrientValue,
  readEnergyKcal,
  readNutrient,
} from '@/services/off/nutriments';

/**
 * Estos tests son el contrato de la distinción que sostiene todo el paso: un
 * nutriente que la fuente no aporta no es un nutriente que vale cero.
 */

describe('parseNutrientValue: lo que la fuente no aporta', () => {
  it('trata la clave ausente como desconocida', () => {
    expect(parseNutrientValue(undefined)).toEqual({ kind: 'absent' });
  });

  it('trata el nulo como desconocido', () => {
    expect(parseNutrientValue(null)).toEqual({ kind: 'absent' });
  });

  it('trata la cadena vacía como desconocida, no como cero', () => {
    // Este es el caso más traicionero de todos: `Number('')` vale 0, así que
    // cualquier conversión ingenua convertiría un campo que la fuente dejó en
    // blanco en un cero perfectamente creíble.
    expect(Number('')).toBe(0);
    expect(parseNutrientValue('')).toEqual({ kind: 'absent' });
    expect(parseNutrientValue('   ')).toEqual({ kind: 'absent' });
  });
});

describe('parseNutrientValue: lo que vale cero de verdad', () => {
  it('conserva el cero numérico como un valor', () => {
    expect(parseNutrientValue(0)).toEqual({ kind: 'value', value: 0 });
  });

  it('conserva el cero escrito como texto', () => {
    expect(parseNutrientValue('0')).toEqual({ kind: 'value', value: 0 });
    expect(parseNutrientValue('0.0')).toEqual({ kind: 'value', value: 0 });
  });

  it('no confunde el cero con la ausencia en ninguna dirección', () => {
    const cero = parseNutrientValue(0);
    const ausente = parseNutrientValue(undefined);
    expect(cero).not.toEqual(ausente);
    expect(cero.kind).toBe('value');
    expect(ausente.kind).toBe('absent');
  });
});

describe('parseNutrientValue: números normales', () => {
  it('lee un número', () => {
    expect(parseNutrientValue(12.5)).toEqual({ kind: 'value', value: 12.5 });
  });

  it('lee un número escrito con punto decimal', () => {
    expect(parseNutrientValue('1.5')).toEqual({ kind: 'value', value: 1.5 });
  });

  it('lee un número escrito con coma decimal', () => {
    // Open Food Facts lo rellenan personas de toda Europa y la coma decimal es
    // lo normal en media docena de idiomas.
    expect(parseNutrientValue('1,5')).toEqual({ kind: 'value', value: 1.5 });
  });
});

describe('parseNutrientValue: lo que la fuente aporta pero no sirve', () => {
  it.each([
    ['un negativo', -3],
    ['NaN', Number.NaN],
    ['infinito', Number.POSITIVE_INFINITY],
    ['texto no numérico', 'N/A'],
    ['notación hexadecimal', '0x10'],
    ['un booleano', true],
    ['un objeto', {}],
    ['una lista', []],
  ])('descarta %s como inservible', (_caso, raw) => {
    expect(parseNutrientValue(raw)).toEqual({ kind: 'unusable', raw });
  });

  it('no cae en la interpretación numérica implícita de JavaScript', () => {
    // `Number('0x10')` vale 16 y `Number(true)` vale 1. Comprobar contra una
    // expresión regular antes de convertir es lo que evita que un dato basura
    // entre en el historial disfrazado de medida.
    expect(Number('0x10')).toBe(16);
    expect(parseNutrientValue('0x10').kind).toBe('unusable');
  });

  it('distingue lo inservible de lo ausente, aunque el dominio los trate igual', () => {
    // La diferencia no llega al dominio, pero existir le permite a la interfaz
    // decir "la fuente traía basura" en vez de "la fuente no lo dice".
    expect(parseNutrientValue('N/A').kind).not.toBe('absent');
    expect(gramsOf(parseNutrientValue('N/A'))).toBeUndefined();
    expect(gramsOf(parseNutrientValue(undefined))).toBeUndefined();
  });
});

describe('gramsOf', () => {
  it('convierte un cero real en cero gramos, no en indefinido', () => {
    expect(gramsOf(parseNutrientValue(0))).toBe(0);
  });

  it('devuelve indefinido para lo desconocido, que es lo que omite la clave', () => {
    expect(gramsOf(parseNutrientValue(undefined))).toBeUndefined();
  });
});

describe('readNutrient', () => {
  const nutriments = { sugars_100g: 0, salt_100g: 1.2 };

  it('lee un cero presente en el diccionario', () => {
    expect(readNutrient(nutriments, 'sugars_100g')).toEqual({ kind: 'value', value: 0 });
  });

  it('lee como ausente una clave que no está en el diccionario', () => {
    expect(readNutrient(nutriments, 'fiber_100g')).toEqual({ kind: 'absent' });
  });

  it('tolera que no haya diccionario de nutrientes', () => {
    expect(readNutrient(undefined, 'sugars_100g')).toEqual({ kind: 'absent' });
    expect(readNutrient(null, 'sugars_100g')).toEqual({ kind: 'absent' });
  });
});

describe('readEnergyKcal', () => {
  it('prefiere las kilocalorías cuando la fuente las da', () => {
    expect(readEnergyKcal({ 'energy-kcal_100g': 52 })).toBe(52);
  });

  it('respeta una energía de cero en lugar de buscar en otra clave', () => {
    // El test que justifica la rama `value` de la unión. Un agua declara cero
    // kilocalorías y cero kilojulios; si la comprobación fuera `if (kcal)`, el
    // cero sería falso y se pasaría a la siguiente clave. Aquí se exagera la
    // trampa poniendo un valor absurdo en kilojulios: si el resultado no es
    // cero, es que el cero de kilocalorías se ha ignorado.
    expect(readEnergyKcal({ 'energy-kcal_100g': 0, 'energy-kj_100g': 2000 })).toBe(0);
  });

  it('convierte desde kilojulios cuando no hay kilocalorías', () => {
    const kcal = readEnergyKcal({ 'energy-kj_100g': 418.4 });
    expect(kcal).toBeCloseTo(100, 10);
  });

  it('usa la clave genérica solo si la unidad viene declarada', () => {
    expect(readEnergyKcal({ energy_100g: 418.4, energy_unit: 'kJ' })).toBeCloseTo(100, 10);
    expect(readEnergyKcal({ energy_100g: 100, energy_unit: 'kcal' })).toBe(100);
  });

  it('no adivina la unidad de la clave genérica', () => {
    // Sin unidad, ese número podría ser kilojulios o kilocalorías, y un factor de
    // 4,184 de diferencia en la energía no es un detalle. Mejor pedirlo a mano.
    expect(readEnergyKcal({ energy_100g: 418.4 })).toBeUndefined();
  });

  it('devuelve indefinido cuando la fuente no aporta energía', () => {
    expect(readEnergyKcal({ proteins_100g: 3 })).toBeUndefined();
    expect(readEnergyKcal(undefined)).toBeUndefined();
  });

  it('no acepta una energía en blanco como cero', () => {
    expect(readEnergyKcal({ 'energy-kcal_100g': '' })).toBeUndefined();
  });
});
