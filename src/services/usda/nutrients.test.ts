import { describe, expect, it } from 'vitest';

import { MICRONUTRIENT_IDS } from '@/domain/nutrition/micronutrients';
import {
  FDC_NUTRIENT_NUMBERS,
  findInDetailNutrients,
  findInSearchNutrients,
  microAmountFor,
} from '@/services/usda/nutrients';

describe('correspondencia de números de nutriente de FDC', () => {
  it('mapea veintiuno de los veintidós micronutrientes del catálogo', () => {
    const mapeados = Object.keys(FDC_NUTRIENT_NUMBERS);
    expect(mapeados).toHaveLength(21);
    expect(mapeados.length).toBe(MICRONUTRIENT_IDS.length - 1);
  });

  it('el yodo queda fuera a propósito: no hay número de FDC fiable', () => {
    expect(FDC_NUTRIENT_NUMBERS.iodine).toBeUndefined();
  });

  it('cada número es un texto no vacío, distinto de todos los demás', () => {
    const numeros = Object.values(FDC_NUTRIENT_NUMBERS);
    for (const numero of numeros) {
      expect(typeof numero).toBe('string');
      expect(numero.length).toBeGreaterThan(0);
    }
    expect(new Set(numeros).size).toBe(numeros.length);
  });
});

describe('findInSearchNutrients', () => {
  const nutrients = [
    { nutrientNumber: '203', value: 24.63 },
    { nutrientNumber: '307', value: 6 },
    { nutrientNumber: '999', value: -1 },
  ];

  it('encuentra el valor por su número de nutriente', () => {
    expect(findInSearchNutrients(nutrients, '203')).toBe(24.63);
  });

  it('no encuentra lo que no está en la lista: desconocido, no cero', () => {
    expect(findInSearchNutrients(nutrients, '999999')).toBeUndefined();
  });

  it('un valor negativo no es una medida usable', () => {
    expect(findInSearchNutrients(nutrients, '999')).toBeUndefined();
  });

  it('una lista ausente no revienta', () => {
    expect(findInSearchNutrients(undefined, '203')).toBeUndefined();
    expect(findInSearchNutrients(null, '203')).toBeUndefined();
  });

  it('compara el número como texto, aunque llegue como número', () => {
    expect(findInSearchNutrients([{ nutrientNumber: 203, value: 1 }], '203')).toBe(1);
  });
});

describe('findInDetailNutrients', () => {
  it('lee la forma de la ficha abreviada, `number`/`amount`', () => {
    const nutrients = [{ number: '303', amount: 7.54 }];
    expect(findInDetailNutrients(nutrients, '303')).toBe(7.54);
  });
});

describe('microAmountFor', () => {
  it('envuelve en miligramos los micronutrientes que se miden en miligramos', () => {
    expect(microAmountFor('iron', 7.54)).toBe(7.54);
  });

  it('envuelve en microgramos los que se miden en microgramos', () => {
    expect(microAmountFor('vitaminB12', 0)).toBe(0);
  });
});
