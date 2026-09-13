import { describe, expect, it } from 'vitest';

import type { FoodId, ServingId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import { cocaColaZero } from '@/services/off/__fixtures__/coca-cola-zero';
import { limao } from '@/services/off/__fixtures__/limao';
import { findFoodByBarcode, searchFoods } from '@/services/off';
import type { NormalizationContext } from '@/services/off/normalize';
import { createFakeFetch, jsonResponse } from '@/test/fake-fetch';

/** Las dos mitades del servicio, red y normalización, trabajando juntas. */

const FETCHED_AT = instant('2026-09-13T12:00:00.000Z');

function testContext(): NormalizationContext {
  let counter = 0;
  return {
    now: () => FETCHED_AT,
    newFoodId: () => `food-${++counter}` as FoodId,
    newServingId: () => `serving-${++counter}` as ServingId,
  };
}

/** Atajo: una respuesta JSON de nuestra API con el cuerpo que diga el test. */
const apiReturns = (body: unknown, status = 200) =>
  createFakeFetch(() => jsonResponse(body, { status }));

describe('searchFoods', () => {
  it('no sale a la red con una consulta demasiado corta', async () => {
    // No es una optimización. El límite de Open Food Facts es de diez búsquedas
    // por minuto y por dirección IP, y en Vercel esa dirección la compartimos con
    // desconocidos: cada petición que no hace falta se la quitamos a alguien.
    const { fetchImpl, calls } = apiReturns({ query: 'le', page: 1, count: 0, products: [] });
    const page = await searchFoods('le', { fetchImpl });

    expect(calls).toEqual([]);
    expect(page.foods).toEqual([]);
    expect(page.total).toBe(0);
  });

  it('reparte los resultados entre alimentos completos y borradores', async () => {
    const { fetchImpl } = apiReturns({
      query: 'refresco',
      page: 1,
      count: 2,
      products: [cocaColaZero, limao],
    });

    const page = await searchFoods('refresco', { fetchImpl, context: testContext() });

    expect(page.total).toBe(2);
    expect(page.foods).toHaveLength(1);
    expect(page.drafts).toHaveLength(1);
    expect(page.foods[0]?.name).toBe('Coca-Cola zero azúcar');
    expect(page.drafts[0]?.missing).toEqual(['carbohydrates']);
    expect(page.unreadable).toBe(0);
  });
});

describe('findFoodByBarcode', () => {
  it('normaliza el producto que encuentra', async () => {
    const { fetchImpl } = apiReturns({ barcode: '5449000131805', product: cocaColaZero });
    const result = await findFoodByBarcode('5449000131805', {
      fetchImpl,
      context: testContext(),
    });

    expect(result.kind).toBe('complete');
    expect(result.kind === 'complete' && result.food.per100.macros.sugars).toBe(0);
  });

  it('distingue un código que la fuente no conoce', async () => {
    // `notFound` y `unreadable` son cosas distintas, y la interfaz responde
    // distinto a cada una: "no lo encontramos, créalo a mano" frente a "lo
    // encontramos pero no lo entendemos".
    const { fetchImpl } = apiReturns({ barcode: '0000000000000', product: null }, 404);
    const result = await findFoodByBarcode('0000000000000', { fetchImpl });

    expect(result.kind).toBe('notFound');
  });

  it('distingue un producto que llega roto', async () => {
    const { fetchImpl } = apiReturns({ barcode: '5449000131805', product: { sin: 'nada' } });
    const result = await findFoodByBarcode('5449000131805', { fetchImpl });

    expect(result.kind).toBe('unreadable');
  });
});
