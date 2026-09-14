import { describe, expect, it } from 'vitest';

import { UsdaApiError, fetchUsdaFood, searchUsdaFoods } from '@/services/usda/client';
import { createFakeFetch, jsonResponse } from '@/test/fake-fetch';

/**
 * Tests del transporte. Ninguno sale a la red, igual que `off/client.test.ts`.
 */

const SEARCH_BODY = { query: 'lentejas', foods: [{ fdcId: 1 }, { fdcId: 2 }] };

describe('a quién se le habla', () => {
  it('llama solo a nuestra API, nunca directamente a FDC', () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    return searchUsdaFoods('lentejas', { fetchImpl }).then(() => {
      expect(calls[0]?.url).toBe('/api/usda/search?q=lentejas');
      expect(calls[0]?.url).not.toContain('nal.usda.gov');
      expect(calls[0]?.url).not.toContain('api_key');
    });
  });

  it('normaliza el texto, por el mismo motivo de caché que D-041 documentó para OFF', async () => {
    const urlFor = async (query: string) => {
      const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
      await searchUsdaFoods(query, { fetchImpl });
      return calls[0]?.url;
    };

    const escrituras = await Promise.all([
      urlFor('Lentejas'),
      urlFor('lentejas'),
      urlFor('  LENTEJAS  '),
    ]);

    expect(new Set(escrituras).size).toBe(1);
    expect(escrituras[0]).toBe('/api/usda/search?q=lentejas');
  });

  it('pone el fdcId en la ruta', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse({ fdcId: 173410, food: { fdcId: 173410 } }),
    );
    await fetchUsdaFood(173410, { fetchImpl });
    expect(calls[0]?.url).toBe('/api/usda/food/173410');
  });
});

describe('respuestas correctas', () => {
  it('devuelve la envoltura validada de una búsqueda', async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    const payload = await searchUsdaFoods('lentejas', { fetchImpl });
    expect(payload.query).toBe('lentejas');
    expect(payload.foods).toHaveLength(2);
  });

  it('trata un fdcId desconocido como resultado normal, no como error', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ fdcId: 999999999, food: null }, { status: 404 }),
    );
    const payload = await fetchUsdaFood(999999999, { fetchImpl });
    expect(payload.food).toBeNull();
  });
});

describe('errores de la API', () => {
  it('distingue el límite de la fuente del nuestro, con los segundos de espera', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(
        { error: { code: 'upstream_rate_limited', message: 'FDC ha limitado el ritmo.' } },
        { status: 429, headers: { 'retry-after': '3600' } },
      ),
    );

    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UsdaApiError);
    expect(error).toMatchObject({
      code: 'upstream_rate_limited',
      status: 429,
      retryAfterSeconds: 3600,
    });
  });

  it('conserva el código que declaran nuestras propias funciones', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(
        { error: { code: 'upstream_timeout', message: 'Ha tardado demasiado.' } },
        { status: 504 },
      ),
    );
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'upstream_timeout', status: 504 });
  });

  it('deduce un código del estado cuando el cuerpo no es nuestro', async () => {
    const { fetchImpl } = createFakeFetch(
      () => new Response('<html>Gateway Timeout</html>', { status: 502 }),
    );
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'upstream_error', status: 502 });
  });
});

describe('nuestro propio contrato', () => {
  it('rechaza una envoltura que no cumple lo acordado', async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ query: 'lentejas' }));
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'malformed_response' });
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { fetchImpl } = createFakeFetch(() => new Response('no soy json', { status: 200 }));
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'malformed_response' });
  });
});

describe('red y cancelación', () => {
  it('traduce un fallo de red, que es el caso de estar sin conexión', async () => {
    const { fetchImpl } = createFakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'network' });
  });

  it('deja pasar la cancelación tal cual, sin envolverla', async () => {
    const { fetchImpl } = createFakeFetch(() => {
      const aborted = new Error('The operation was aborted.');
      aborted.name = 'AbortError';
      throw aborted;
    });
    const error = await searchUsdaFoods('lentejas', { fetchImpl }).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(UsdaApiError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('entrega la señal de cancelación al fetch', async () => {
    const controller = new AbortController();
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    await searchUsdaFoods('lentejas', { fetchImpl, signal: controller.signal });
    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });
});
