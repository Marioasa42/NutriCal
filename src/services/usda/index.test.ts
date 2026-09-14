import { describe, expect, it } from 'vitest';

import type { FoodId, ServingId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import { fetchUsdaFoodProfile, searchUsdaCatalog } from '@/services/usda';
import type { NormalizationContext } from '@/services/usda/normalize';
import { createFakeFetch, jsonResponse } from '@/test/fake-fetch';

/** Las dos mitades del servicio, red y normalización, trabajando juntas. */

const FETCHED_AT = instant('2026-09-14T12:00:00.000Z');

function testContext(): NormalizationContext {
  let counter = 0;
  return {
    now: () => FETCHED_AT,
    newFoodId: () => `food-${++counter}` as FoodId,
    newServingId: () => `serving-${++counter}` as ServingId,
  };
}

const apiReturns = (body: unknown, status = 200) =>
  createFakeFetch(() => jsonResponse(body, { status }));

const LENTEJAS = {
  fdcId: 173410,
  description: 'Lentils, raw',
  foodNutrients: [
    { nutrientNumber: '203', value: 24.63 },
    { nutrientNumber: '204', value: 1.06 },
    { nutrientNumber: '205', value: 63.35 },
    { nutrientNumber: '208', value: 353 },
  ],
};

describe('searchUsdaCatalog', () => {
  it('no sale a la red con una consulta demasiado corta', async () => {
    const { fetchImpl, calls } = apiReturns({ query: 'le', foods: [] });
    const page = await searchUsdaCatalog('le', { fetchImpl });

    expect(calls).toEqual([]);
    expect(page.foods).toEqual([]);
  });

  it('normaliza los resultados, sin micronutrientes todavía', async () => {
    const { fetchImpl } = apiReturns({ query: 'lentejas', foods: [LENTEJAS] });
    const page = await searchUsdaCatalog('lentejas', { fetchImpl, context: testContext() });

    expect(page.foods).toHaveLength(1);
    expect(page.foods[0]?.per100.micros).toEqual({});
    expect(page.foods[0]?.source).toEqual({
      kind: 'usda',
      fdcId: 173410,
      fetchedAt: FETCHED_AT,
    });
  });
});

describe('fetchUsdaFoodProfile', () => {
  it('completa el alimento con el panel de micronutrientes', async () => {
    const ficha = {
      fdcId: 173410,
      description: 'Lentils, raw',
      foodNutrients: [
        { number: '203', amount: 24.63 },
        { number: '204', amount: 1.06 },
        { number: '205', amount: 63.35 },
        { number: '208', amount: 353 },
        { number: '303', amount: 7.54 },
      ],
    };
    const { fetchImpl } = apiReturns({ fdcId: 173410, food: ficha });
    const result = await fetchUsdaFoodProfile(173410, { fetchImpl, context: testContext() });

    expect(result.kind).toBe('complete');
    expect(result.kind === 'complete' && result.food.per100.micros.iron).toBe(7.54);
  });

  it('un fdcId que FDC ya no conoce se trata como ilegible, no como fallo', async () => {
    const { fetchImpl } = apiReturns({ fdcId: 999999999, food: null }, 404);
    const result = await fetchUsdaFoodProfile(999999999, { fetchImpl });

    expect(result.kind).toBe('unreadable');
  });
});
