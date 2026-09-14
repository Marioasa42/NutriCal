import { describe, expect, it } from 'vitest';

import { barcodeFromUrl, handleProduct, handleSearch, type HandlerDeps } from './handlers.js';
import { createTokenBucket, type TokenBucket } from './rate-limit.js';

/**
 * Los handlers reciben sus dependencias por parámetro, así que probarlos es
 * pasarles una petición y mirar la respuesta. No hace falta levantar un
 * servidor, ni sustituir `fetch` global, ni esperar a un despliegue.
 */

const SEARCH_URL = 'https://nutrical.test/api/off/search';
const PRODUCT_URL = 'https://nutrical.test/api/off/product';

function upstream(status: number, body: unknown): typeof fetch {
  return () =>
    Promise.resolve(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
}

function failing(error: Error): typeof fetch {
  return () => Promise.reject(error);
}

/** Como `upstream`, pero con cabeceras propias: hace falta para el `retry-after`. */
function upstreamWithHeaders(status: number, headers: Record<string, string>): typeof fetch {
  return () => Promise.resolve(new Response(null, { status, headers }));
}

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
  const bucket: TokenBucket = createTokenBucket({ capacity: 100, refillPerMinute: 100 });
  return {
    bucket,
    now: () => 1_000_000,
    fetchImpl: upstream(200, { count: 0, products: [] }),
    ...overrides,
  };
}

describe('búsqueda', () => {
  it('rechaza una consulta demasiado corta sin salir a la red', async () => {
    let called = false;
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=le`),
      deps({
        fetchImpl: () => {
          called = true;
          return Promise.reject(new Error('no debería llamarse'));
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('invalid_request');
  });

  it('rechaza la ausencia del parámetro', async () => {
    const response = await handleSearch(new Request(SEARCH_URL), deps());
    expect(response.status).toBe(400);
  });

  it('devuelve los productos con la cabecera de caché compartida', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(200, { count: 2, products: [{ code: '1' }, { code: '2' }] }) }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=600');
    expect(response.headers.get('cache-control')).toContain('stale-while-revalidate');

    const body = (await response.json()) as { count: number; products: unknown[]; query: string };
    expect(body.count).toBe(2);
    expect(body.products).toHaveLength(2);
    expect(body.query).toBe('leche');
  });

  it('devuelve la consulta ya normalizada, que es la clave de caché', async () => {
    const response = await handleSearch(new Request(`${SEARCH_URL}?q=+LECHE++Entera+`), deps());
    const body = (await response.json()) as { query: string };
    expect(body.query).toBe('leche entera');
  });

  it('soporta una respuesta sin la forma esperada sin romperse', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(200, 'esto no es un objeto') }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; products: unknown[] };
    expect(body.count).toBe(0);
    expect(body.products).toEqual([]);
  });

  it('corta cuando se agota el límite de ritmo y dice cuándo reintentar', async () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerMinute: 6 });
    const shared = deps({ bucket });

    expect((await handleSearch(new Request(`${SEARCH_URL}?q=leche`), shared)).status).toBe(200);

    const limited = await handleSearch(new Request(`${SEARCH_URL}?q=leche`), shared);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('10');
    expect(limited.headers.get('cache-control')).toBe('no-store');
  });

  it('traduce un error de la fuente a un 502 sin cachear', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(500, null) }),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  /**
   * La regresión de D-040, y la razón de que este bloque exista.
   *
   * Que el límite de la fuente saliera por el mismo desagüe que "la fuente ha
   * fallado" no era un detalle de nomenclatura: `upstream_error` estaba en la
   * lista de lo reintentable, así que el navegador respondía a un "para" con dos
   * peticiones más. Si alguien vuelve a unificar estas dos ramas, este test lo
   * dice.
   */
  it('el límite de la fuente NO es un 502: es un 429 con su propio código', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(429, null) }),
    );

    expect(response.status).toBe(429);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('upstream_rate_limited');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('respeta el retry-after que manda la fuente', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstreamWithHeaders(429, { 'retry-after': '37' }) }),
    );

    expect(response.headers.get('retry-after')).toBe('37');
  });

  it('si la fuente no dice cuánto esperar, esperamos su ventana entera', async () => {
    // Inventar una espera corta es volver a llamar a una puerta que acaban de
    // cerrarnos. Su ventana documentada es de un minuto.
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(429, null) }),
    );

    expect(response.headers.get('retry-after')).toBe('60');
  });

  it('nuestro límite y el suyo no se confunden', async () => {
    const bucket = createTokenBucket({ capacity: 0, refillPerMinute: 1 });
    const ours = await handleSearch(new Request(`${SEARCH_URL}?q=leche`), deps({ bucket }));
    const theirs = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: upstream(429, null) }),
    );

    // Los dos son 429 porque los dos obligan a esperar, pero el código distingue
    // quién puso el límite: el nuestro ni siquiera llegó a salir a la red.
    expect(ours.status).toBe(429);
    expect(theirs.status).toBe(429);
    expect(((await ours.json()) as { error: { code: string } }).error.code).toBe('rate_limited');
    expect(((await theirs.json()) as { error: { code: string } }).error.code).toBe(
      'upstream_rate_limited',
    );
  });

  it('distingue el tiempo agotado de un fallo cualquiera', async () => {
    const timeout = Object.assign(new Error('tardó demasiado'), { name: 'TimeoutError' });
    const timedOut = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: failing(timeout) }),
    );
    expect(timedOut.status).toBe(504);

    const broken = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`),
      deps({ fetchImpl: failing(new Error('red caída')) }),
    );
    expect(broken.status).toBe(502);
  });

  it('rechaza métodos que no sean GET', async () => {
    const response = await handleSearch(
      new Request(`${SEARCH_URL}?q=leche`, { method: 'POST' }),
      deps(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});

describe('producto por código de barras', () => {
  it('extrae el código del último segmento de la ruta', () => {
    expect(barcodeFromUrl(`${PRODUCT_URL}/8410128750121`)).toBe('8410128750121');
    expect(barcodeFromUrl(`${PRODUCT_URL}/8410128750121?x=1`)).toBe('8410128750121');
  });

  it('rechaza un código inválido sin salir a la red', async () => {
    let called = false;
    const response = await handleProduct(
      new Request(`${PRODUCT_URL}/no-es-un-codigo`),
      deps({
        fetchImpl: () => {
          called = true;
          return Promise.reject(new Error('no debería llamarse'));
        },
      }),
    );

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });

  it('devuelve el producto con caché larga', async () => {
    const response = await handleProduct(
      new Request(`${PRODUCT_URL}/8410128750121`),
      deps({ fetchImpl: upstream(200, { status: 1, product: { code: '8410128750121' } }) }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=86400');

    const body = (await response.json()) as { barcode: string; product: { code: string } };
    expect(body.barcode).toBe('8410128750121');
    expect(body.product.code).toBe('8410128750121');
  });

  it('trata un código desconocido como 404 con caché negativa corta', async () => {
    const response = await handleProduct(
      new Request(`${PRODUCT_URL}/8410128750121`),
      deps({ fetchImpl: upstream(200, { status: 0, status_verbose: 'product not found' }) }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=300');
    const body = (await response.json()) as { product: null };
    expect(body.product).toBeNull();
  });

  it('también cuando la fuente responde 404 directamente', async () => {
    const response = await handleProduct(
      new Request(`${PRODUCT_URL}/8410128750121`),
      deps({ fetchImpl: upstream(404, null) }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('public, s-maxage=300');
  });
});
