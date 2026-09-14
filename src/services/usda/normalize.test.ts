import { describe, expect, it } from 'vitest';

import type { Food } from '@/domain/food/food';
import type { FoodId, ServingId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import {
  normalizeFoodDetail,
  normalizeSearchFood,
  normalizeSearchFoods,
  type NormalizationContext,
  type UsdaNormalization,
} from '@/services/usda/normalize';

/**
 * Tests de normalización de USDA FoodData Central.
 *
 * A diferencia de `off/normalize.test.ts`, los alimentos de aquí no son
 * capturas de la API real guardadas en `__fixtures__`: son construidos a
 * mano, con la forma de campo verificada contra la API real y documentada en
 * D-047 y D-048 (`nutrientNumber`/`value` en un resultado de búsqueda,
 * `number`/`amount` en la ficha con `format=abridged`). Se hace así, y no
 * capturando una respuesta nueva, para no volver a tocar la clave de la API
 * al escribir este PR. Sigue el mismo patrón que el "yogur con la tabla en
 * mililitros" de `off/normalize.test.ts`: un caso construido para probar algo
 * concreto, declarado como tal.
 */

const FETCHED_AT = instant('2026-09-14T12:00:00.000Z');

function testContext(): NormalizationContext {
  let counter = 0;
  return {
    now: () => FETCHED_AT,
    newFoodId: () => `food-${++counter}` as FoodId,
    newServingId: () => `serving-${++counter}` as ServingId,
  };
}

function expectComplete(result: UsdaNormalization): Food {
  if (result.kind !== 'complete') {
    throw new Error(`Se esperaba un alimento completo y llegó "${result.kind}".`);
  }
  return result.food;
}

/** Un resultado de `/foods/search`: solo el panel básico, forma `nutrientNumber`/`value`. */
const LENTEJAS_BUSQUEDA = {
  fdcId: 173410,
  description: 'Lentils, raw',
  dataType: 'SR Legacy',
  foodNutrients: [
    { nutrientNumber: '203', nutrientName: 'Protein', unitName: 'G', value: 24.63 },
    { nutrientNumber: '204', nutrientName: 'Total lipid (fat)', unitName: 'G', value: 1.06 },
    { nutrientNumber: '205', nutrientName: 'Carbohydrate, by difference', unitName: 'G', value: 63.35 },
    { nutrientNumber: '208', nutrientName: 'Energy', unitName: 'KCAL', value: 353 },
    { nutrientNumber: '269', nutrientName: 'Total Sugars', unitName: 'G', value: 2.03 },
    { nutrientNumber: '291', nutrientName: 'Fiber, total dietary', unitName: 'G', value: 10.7 },
    { nutrientNumber: '301', nutrientName: 'Calcium, Ca', unitName: 'MG', value: 35 },
    { nutrientNumber: '307', nutrientName: 'Sodium, Na', unitName: 'MG', value: 6 },
  ],
};

/** El mismo alimento, pedido con `format=abridged`: panel completo, forma `number`/`amount`. */
const LENTEJAS_FICHA = {
  fdcId: 173410,
  description: 'Lentils, raw',
  dataType: 'SR Legacy',
  foodNutrients: [
    { number: '203', name: 'Protein', unitName: 'G', amount: 24.63 },
    { number: '204', name: 'Total lipid (fat)', unitName: 'G', amount: 1.06 },
    { number: '205', name: 'Carbohydrate, by difference', unitName: 'G', amount: 63.35 },
    { number: '208', name: 'Energy', unitName: 'KCAL', amount: 353 },
    { number: '269', name: 'Total Sugars', unitName: 'G', amount: 2.03 },
    { number: '291', name: 'Fiber, total dietary', unitName: 'G', amount: 10.7 },
    { number: '301', name: 'Calcium, Ca', unitName: 'MG', amount: 35 },
    { number: '303', name: 'Iron, Fe', unitName: 'MG', amount: 7.54 },
    { number: '304', name: 'Magnesium, Mg', unitName: 'MG', amount: 47 },
    { number: '305', name: 'Phosphorus, P', unitName: 'MG', amount: 281 },
    { number: '306', name: 'Potassium, K', unitName: 'MG', amount: 677 },
    { number: '307', name: 'Sodium, Na', unitName: 'MG', amount: 6 },
    { number: '309', name: 'Zinc, Zn', unitName: 'MG', amount: 3.27 },
    { number: '312', name: 'Copper, Cu', unitName: 'MG', amount: 0.75 },
    { number: '315', name: 'Manganese, Mn', unitName: 'MG', amount: 1.39 },
    { number: '317', name: 'Selenium, Se', unitName: 'UG', amount: 8.3 },
    { number: '320', name: 'Vitamin A, RAE', unitName: 'UG', amount: 2 },
    { number: '323', name: 'Vitamin E (alpha-tocopherol)', unitName: 'MG', amount: 0.49 },
    { number: '401', name: 'Vitamin C, total ascorbic acid', unitName: 'MG', amount: 4.5 },
    { number: '404', name: 'Thiamin', unitName: 'MG', amount: 0.87 },
    { number: '405', name: 'Riboflavin', unitName: 'MG', amount: 0.21 },
    { number: '406', name: 'Niacin', unitName: 'MG', amount: 2.6 },
    { number: '415', name: 'Vitamin B-6', unitName: 'MG', amount: 0.54 },
    { number: '418', name: 'Vitamin B-12', unitName: 'UG', amount: 0 },
    { number: '430', name: 'Vitamin K (phylloquinone)', unitName: 'UG', amount: 1.7 },
    { number: '435', name: 'Folate, total', unitName: 'UG', amount: 479 },
    // Sin vitamina D (328): las lentejas no la declaran. Queda ausente, no cero.
  ],
};

describe('normalizeSearchFood', () => {
  const food = expectComplete(normalizeSearchFood(LENTEJAS_BUSQUEDA, testContext()));

  it('lee las macros del panel básico de búsqueda', () => {
    expect(food.per100.macros.energy).toBe(353);
    expect(food.per100.macros.protein).toBe(24.63);
    expect(food.per100.macros.carbohydrates).toBe(63.35);
    expect(food.per100.macros.fat).toBe(1.06);
    expect(food.per100.macros.sugars).toBe(2.03);
    expect(food.per100.macros.fiber).toBe(10.7);
  });

  it('no trae ningún micronutriente: D-048, el panel completo solo llega con la ficha', () => {
    expect(food.per100.micros).toEqual({});
  });

  it('guarda de dónde salió y cuándo, con el fdcId y no un código de barras', () => {
    expect(food.source).toEqual({ kind: 'usda', fdcId: 173410, fetchedAt: FETCHED_AT });
  });

  it('siempre se mide en gramos, y sin porciones', () => {
    expect(food.baseUnit).toBe('g');
    expect(food.servings).toEqual([]);
  });

  it('toma el nombre de `description`', () => {
    expect(food.name).toBe('Lentils, raw');
  });
});

describe('normalizeFoodDetail', () => {
  const food = expectComplete(normalizeFoodDetail(LENTEJAS_FICHA, testContext()));

  it('lee las mismas macros que la búsqueda, aunque los campos se llamen distinto', () => {
    expect(food.per100.macros.energy).toBe(353);
    expect(food.per100.macros.protein).toBe(24.63);
  });

  it('lee los veintiún micronutrientes que sabemos mapear', () => {
    expect(food.per100.micros.calcium).toBe(35);
    expect(food.per100.micros.iron).toBe(7.54);
    expect(food.per100.micros.magnesium).toBe(47);
    expect(food.per100.micros.phosphorus).toBe(281);
    expect(food.per100.micros.potassium).toBe(677);
    expect(food.per100.micros.sodium).toBe(6);
    expect(food.per100.micros.zinc).toBe(3.27);
    expect(food.per100.micros.copper).toBe(0.75);
    expect(food.per100.micros.manganese).toBe(1.39);
    expect(food.per100.micros.selenium).toBe(8.3);
    expect(food.per100.micros.vitaminA).toBe(2);
    expect(food.per100.micros.vitaminE).toBe(0.49);
    expect(food.per100.micros.vitaminC).toBe(4.5);
    expect(food.per100.micros.thiamin).toBe(0.87);
    expect(food.per100.micros.riboflavin).toBe(0.21);
    expect(food.per100.micros.niacin).toBe(2.6);
    expect(food.per100.micros.vitaminB6).toBe(0.54);
    expect(food.per100.micros.vitaminK).toBe(1.7);
    expect(food.per100.micros.folate).toBe(479);
  });

  it('conserva un cero real de la fuente, como la B12 de este alimento', () => {
    expect(food.per100.micros.vitaminB12).toBe(0);
  });

  it('deja ausente lo que la fuente no declara, como la vitamina D aquí', () => {
    expect('vitaminD' in food.per100.micros).toBe(false);
  });

  it('el yodo queda siempre ausente, sea cual sea la entrada: no hay número de FDC fiable', () => {
    // Ver `nutrients.ts`: pedirlo sería inventar un dato con aspecto de real.
    expect('iodine' in food.per100.micros).toBe(false);
  });
});

describe('marca del producto', () => {
  it('prefiere `brandName` sobre `brandOwner`, por ser lo más específico del producto', () => {
    const food = expectComplete(
      normalizeSearchFood(
        { ...LENTEJAS_BUSQUEDA, brandOwner: 'ACME Foods Inc.', brandName: 'ACME Lentejas' },
        testContext(),
      ),
    );
    expect(food.brand).toBe('ACME Lentejas');
  });

  it('cae a `brandOwner` cuando no hay `brandName`', () => {
    const food = expectComplete(
      normalizeSearchFood({ ...LENTEJAS_BUSQUEDA, brandOwner: 'ACME Foods Inc.' }, testContext()),
    );
    expect(food.brand).toBe('ACME Foods Inc.');
  });

  it('no declara marca cuando la fuente no trae ninguna de las dos', () => {
    const food = expectComplete(normalizeSearchFood(LENTEJAS_BUSQUEDA, testContext()));
    expect(food.brand).toBeUndefined();
  });
});

describe('producto incompleto', () => {
  it('sale por la rama de completar cuando falta una macro obligatoria', () => {
    const sinCarbohidratos = {
      ...LENTEJAS_BUSQUEDA,
      foodNutrients: LENTEJAS_BUSQUEDA.foodNutrients.filter((n) => n.nutrientNumber !== '205'),
    };
    const result = normalizeSearchFood(sinCarbohidratos, testContext());
    expect(result.kind).toBe('needsCompletion');
    if (result.kind !== 'needsCompletion') {
      return;
    }
    expect(result.draft.missing).toEqual(['carbohydrates']);
    expect(result.draft.macros.protein).toBe(24.63);
  });
});

describe('alimentos ilegibles', () => {
  it.each([
    ['no es un objeto', null],
    ['es una lista', []],
    ['no trae fdcId', { description: 'Sin identificador' }],
  ])('descarta lo que %s', (_caso, raw) => {
    expect(normalizeSearchFood(raw, testContext()).kind).toBe('unreadable');
    expect(normalizeFoodDetail(raw, testContext()).kind).toBe('unreadable');
  });

  it('descarta un alimento sin nombre utilizable', () => {
    const result = normalizeSearchFood({ fdcId: 1, description: '  ' }, testContext());
    expect(result.kind).toBe('unreadable');
  });

  it('nunca lanza, ni con la entrada más hostil', () => {
    for (const raw of [undefined, null, '', 0, [], {}, { fdcId: 'no-es-numero' }]) {
      expect(() => normalizeSearchFood(raw, testContext())).not.toThrow();
      expect(() => normalizeFoodDetail(raw, testContext())).not.toThrow();
    }
  });
});

describe('normalizeSearchFoods', () => {
  it('reparte cada alimento en su montón sin que uno malo tire la página', () => {
    const incompleto = {
      ...LENTEJAS_BUSQUEDA,
      fdcId: 2,
      foodNutrients: LENTEJAS_BUSQUEDA.foodNutrients.filter((n) => n.nutrientNumber !== '205'),
    };
    const resultado = normalizeSearchFoods(
      [LENTEJAS_BUSQUEDA, incompleto, 'basura'],
      testContext(),
    );

    expect(resultado.foods).toHaveLength(1);
    expect(resultado.drafts).toHaveLength(1);
    expect(resultado.unreadable).toBe(1);
  });

  it('devuelve una página vacía sin quejarse si no hay nada', () => {
    expect(normalizeSearchFoods([], testContext())).toEqual({
      foods: [],
      drafts: [],
      unreadable: 0,
    });
  });
});
