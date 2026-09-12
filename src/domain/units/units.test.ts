import { describe, expect, it } from 'vitest';

import { InvariantError } from '@/shared/lib/invariant';
import {
  gramsToMilligrams,
  grams,
  kilocalories,
  kilocaloriesToKilojoules,
  kilojoulesToKilocalories,
  micrograms,
  microgramsToGrams,
  microgramsToMilligrams,
  milligrams,
  milligramsToGrams,
  milligramsToMicrograms,
  minutes,
  scale,
  sum,
} from '@/domain/units/units';

describe('constructores de unidades', () => {
  it('aceptan cero y valores positivos', () => {
    expect(grams(0)).toBe(0);
    expect(grams(125.5)).toBe(125.5);
    expect(kilocalories(2000)).toBe(2000);
    expect(minutes(45)).toBe(45);
  });

  it('rechazan valores negativos', () => {
    expect(() => grams(-1)).toThrow(InvariantError);
    expect(() => kilocalories(-0.5)).toThrow(InvariantError);
    expect(() => minutes(-10)).toThrow(InvariantError);
  });

  it('rechazan valores no finitos', () => {
    expect(() => grams(Number.NaN)).toThrow(InvariantError);
    expect(() => grams(Number.POSITIVE_INFINITY)).toThrow(InvariantError);
  });
});

describe('conversiones de masa', () => {
  it('convierte entre miligramos y gramos en ambos sentidos', () => {
    expect(milligramsToGrams(milligrams(1000))).toBe(1);
    expect(gramsToMilligrams(grams(2.5))).toBe(2500);
  });

  it('convierte entre microgramos y miligramos en ambos sentidos', () => {
    expect(microgramsToMilligrams(micrograms(2400))).toBe(2.4);
    expect(milligramsToMicrograms(milligrams(0.9))).toBeCloseTo(900, 10);
  });

  it('convierte microgramos a gramos', () => {
    // La dosis diaria de referencia de B12 en gramos: el número incómodo que
    // justifica que microgramos sea una unidad de primera clase.
    expect(microgramsToGrams(micrograms(2.4))).toBeCloseTo(0.0000024, 12);
  });

  it('mantiene el valor al ir y volver', () => {
    const original = milligrams(14);
    expect(microgramsToMilligrams(milligramsToMicrograms(original))).toBeCloseTo(14, 10);
  });
});

describe('conversión de energía', () => {
  it('usa el factor oficial de kilojulios por kilocaloría', () => {
    expect(kilocaloriesToKilojoules(kilocalories(100))).toBeCloseTo(418.4, 10);
  });

  it('vuelve al valor original', () => {
    const original = kilocalories(2000);
    expect(kilojoulesToKilocalories(kilocaloriesToKilojoules(original))).toBeCloseTo(2000, 10);
  });
});

describe('escalado y suma', () => {
  it('escala conservando la unidad', () => {
    // 150 g de un alimento cuyo perfil es por 100 g: factor 1,5.
    expect(scale(grams(20), 1.5)).toBe(30);
    expect(scale(kilocalories(52), 1.5)).toBe(78);
  });

  it('escalar por cero da cero', () => {
    expect(scale(grams(20), 0)).toBe(0);
  });

  it('rechaza factores no finitos', () => {
    expect(() => scale(grams(20), Number.NaN)).toThrow(InvariantError);
  });

  it('suma una lista de la misma unidad', () => {
    const total = sum([grams(10), grams(20), grams(0.5)], grams(0));
    expect(total).toBe(30.5);
  });

  it('la suma de una lista vacía es el cero que se le pase', () => {
    expect(sum([], grams(0))).toBe(0);
  });
});
