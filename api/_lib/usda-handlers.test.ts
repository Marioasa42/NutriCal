import { describe, expect, it } from 'vitest';

import { createTokenBucket, type TokenBucket } from './rate-limit.js';
import {
  fdcIdFromUrl,
  handleUsdaFood,
  handleUsdaSearch,
  type UsdaHandlerDeps,
} from './usda-handlers.js';

const SEARCH_URL = 'https://nutrical.test/api/usda/search';
const FOOD_URL = 'https://nutrical.test/api/usda/food';

function upstream(status: number, body: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

function upstreamWithHeaders(status: number, headers: Record<string, string>): typeof fetch {
  return () => Promise.resolve(new Response(null, { status, headers }));
}

function failing(error: Error): typeof fetch {
  return () => Promise.reject(error);
}

function deps(overrides: Partial<UsdaHandlerDeps> = {}): UsdaHandlerDeps {
  const bucket: TokenBucket = createTokenBucket({ capacity: 100, refillPerMinute: 100 });
  return {
    bucket,
    now: () => 1_000_000,
    fetchImpl: upstream(200, { foods: [] }),
    env: { USDA_API_KEY: 'clave-de-prueba' },
    ...overrides,
  };
}

describe('búsqueda en USDA', () => {
  it('rechaza una consulta demasiado corta sin salir a la red', async () => {
    let called = false;
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=al`),
      deps({
        fetchImpl: () => {
          called = true;
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  /**
   * El caso que la decisión D-047 pide probar explícitamente: sin la variable
   * de entorno, la petición no debe llegar a construir una URL sin clave hacia
   * FDC ni reventar con un error sin forma. Tiene que dar un fallo controlado.
   */
  it('sin la clave configurada, da un error controlado y no sale a la red', async () => {
    let called = false;
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({
        env: {},
        fetchImpl: () => {
          called = true;
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(called).toBe(false);
    const body = (await response.json()) as { error: { code: string; message: string } };
    // El mensaje no menciona el nombre de la variable ni ningún detalle
    // interno: eso queda en los registros del servidor, no en la respuesta.
    expect(body.error.message).not.toContain('USDA_API_KEY');
  });

  it('devuelve la lista de alimentos de la respuesta, cacheada', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstream(200, { foods: [{ fdcId: 1 }, { fdcId: 2 }] }) }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { foods: readonly unknown[] };
    expect(body.foods).toHaveLength(2);
    expect(response.headers.get('cache-control')).toContain('s-maxage');
  });

  it('una respuesta rara de la fuente no revienta: se devuelve una lista vacía', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstream(200, 'esto no es un objeto') }),
    );

    const body = (await response.json()) as { foods: readonly unknown[] };
    expect(body.foods).toEqual([]);
  });

  it('el límite de la fuente es un 429 propio, no un 502, y no se confunde con el nuestro', async () => {
    const theirs = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstream(429, null) }),
    );
    expect(theirs.status).toBe(429);
    expect(((await theirs.json()) as { error: { code: string } }).error.code).toBe(
      'upstream_rate_limited',
    );

    const bucket = createTokenBucket({ capacity: 0, refillPerMinute: 1 });
    const ours = await handleUsdaSearch(new Request(`${SEARCH_URL}?q=lentejas`), deps({ bucket }));
    expect(((await ours.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
  });

  it('si la fuente no dice cuánto esperar, se espera su ventana entera (una hora)', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstream(429, null) }),
    );
    expect(response.headers.get('retry-after')).toBe('3600');
  });

  it('respeta el retry-after que sí manda la fuente', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstreamWithHeaders(429, { 'retry-after': '120' }) }),
    );
    expect(response.headers.get('retry-after')).toBe('120');
  });

  it('traduce un error de la fuente a un 502 sin cachear', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: upstream(500, null) }),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('distingue el tiempo agotado de un fallo cualquiera de la red', async () => {
    const timeout = Object.assign(new Error('tardó demasiado'), { name: 'TimeoutError' });
    const timedOut = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: failing(timeout) }),
    );
    expect(timedOut.status).toBe(504);

    const broken = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`),
      deps({ fetchImpl: failing(new Error('red caída')) }),
    );
    expect(broken.status).toBe(502);
  });

  it('rechaza métodos que no sean GET', async () => {
    const response = await handleUsdaSearch(
      new Request(`${SEARCH_URL}?q=lentejas`, { method: 'POST' }),
      deps(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});

describe('alimento por fdcId', () => {
  it('extrae el identificador del último segmento de la ruta', () => {
    expect(fdcIdFromUrl(`${FOOD_URL}/173410`)).toBe('173410');
  });

  it('rechaza un identificador que no es un entero positivo, sin salir a la red', async () => {
    let called = false;
    const response = await handleUsdaFood(
      new Request(`${FOOD_URL}/no-es-un-numero`),
      deps({
        fetchImpl: () => {
          called = true;
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it('sin la clave configurada, da un error controlado y no sale a la red', async () => {
    let called = false;
    const response = await handleUsdaFood(
      new Request(`${FOOD_URL}/173410`),
      deps({
        env: {},
        fetchImpl: () => {
          called = true;
          return Promise.resolve(new Response(null, { status: 200 }));
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(called).toBe(false);
  });

  it('un fdcId que la fuente no conoce es un 404 con cuerpo null, cacheado', async () => {
    const response = await handleUsdaFood(
      new Request(`${FOOD_URL}/999999999`),
      deps({ fetchImpl: upstream(404, null) }),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as { fdcId: number; food: unknown };
    expect(body.food).toBeNull();
    expect(response.headers.get('cache-control')).not.toBe('no-store');
  });

  it('devuelve el alimento envuelto con su fdcId', async () => {
    const response = await handleUsdaFood(
      new Request(`${FOOD_URL}/173410`),
      deps({ fetchImpl: upstream(200, { fdcId: 173410, description: 'Lentils, raw' }) }),
    );

    const body = (await response.json()) as { fdcId: number; food: { description: string } };
    expect(body.fdcId).toBe(173410);
    expect(body.food.description).toBe('Lentils, raw');
  });

  it('rechaza métodos que no sean GET', async () => {
    const response = await handleUsdaFood(
      new Request(`${FOOD_URL}/173410`, { method: 'POST' }),
      deps(),
    );
    expect(response.status).toBe(405);
  });
});
