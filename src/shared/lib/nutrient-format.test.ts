import { describe, expect, it } from 'vitest';

import { grams, kilocalories } from '@/domain/units/units';
import { formatEnergy, formatGrams, listMacroLabels } from '@/shared/lib/nutrient-format';

describe('formatEnergy', () => {
  it('redondea a kilocalorías enteras', () => {
    // El redondeo ocurre aquí y solo aquí (D-023). El dominio entrega la cifra
    // exacta y esta es la única capa que la acorta.
    expect(formatEnergy(kilocalories(247.32))).toBe('247 kcal');
    expect(formatEnergy(kilocalories(99.9))).toBe('100 kcal');
  });

  it('no inventa decimales en las cifras redondas', () => {
    expect(formatEnergy(kilocalories(0))).toBe('0 kcal');
  });
});

describe('formatGrams', () => {
  it('conserva un decimal, que en cantidades pequeñas sí distingue', () => {
    expect(formatGrams(grams(0.4))).toBe('0,4 g');
    expect(formatGrams(grams(12.34))).toBe('12,3 g');
  });

  it('usa la coma decimal del español', () => {
    expect(formatGrams(grams(1.5))).toContain(',');
  });
});

describe('listMacroLabels', () => {
  it('enumera en español, con "y" antes del último', () => {
    expect(listMacroLabels(['protein', 'fat'])).toBe('proteínas y grasas');
    expect(listMacroLabels(['energy', 'protein', 'fat'])).toBe('energía, proteínas y grasas');
  });

  it('con una sola clave no añade conjunción', () => {
    expect(listMacroLabels(['fiber'])).toBe('fibra');
  });
});
