import { describe, expect, it } from 'vitest';

import { OffApiError, fetchProduct, searchProducts } from '@/services/off/client';
import { createFakeFetch, jsonResponse } from '@/test/fake-fetch';

/**
 * Tests del transporte. Ninguno sale a la red: el `fetch` entra por parámetro,
 * igual que en las funciones serverless, así que no hay que sustituir ninguna
 * variable global ni acordarse de restaurarla.
 */

const SEARCH_BODY = { query: 'leche', page: 1, count: 2, products: [{ code: '1' }, { code: '2' }] };

describe('a quién se le habla', () => {
  it('llama solo a nuestra API, nunca a Open Food Facts', () => {
    // El motivo entero de la decisión D-013 depende de esto: la cabecera de
    // identificación, el límite de ritmo y la caché compartida viven en nuestra
    // función serverless, y una llamada directa desde el navegador se las salta.
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    return searchProducts('leche', { fetchImpl }).then(() => {
      expect(calls[0]?.url).toBe('/api/off/search?q=leche');
      expect(calls[0]?.url).not.toContain('openfoodfacts');
    });
  });

  it('pasa la página cuando se pide', async () => {
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse({ ...SEARCH_BODY, page: 3 }));
    await searchProducts('leche', { fetchImpl, page: 3 });
    expect(calls[0]?.url).toBe('/api/off/search?q=leche&page=3');
  });

  it('normaliza el texto, porque la URL es la clave de caché de la red de distribución', async () => {
    /*
     * El test que faltaba, y faltaba por un motivo que conviene recordar: las dos
     * puntas se probaban por separado y el trato ENTRE ellas no se probaba en
     * ninguna. `contracts/text.ts` afirmaba por escrito que las dos cachés
     * aciertan a la vez ante "Plátano" y "platano". Medido, daban tres entradas
     * distintas, porque el navegador normalizaba solo la clave de TanStack Query
     * y mandaba a la red el texto crudo. La función serverless normalizaba por
     * dentro, pero eso llega tarde: la caché compartida y el cubo de fichas
     * quedan por delante de ella. Ver D-041.
     */
    const urlFor = async (query: string) => {
      const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
      await searchProducts(query, { fetchImpl });
      return calls[0]?.url;
    };

    const escrituras = await Promise.all([
      urlFor('Plátano'),
      urlFor('platano'),
      urlFor('  PLÁTANO  '),
      urlFor('plátano'),
    ]);

    expect(new Set(escrituras).size).toBe(1);
    expect(escrituras[0]).toBe('/api/off/search?q=platano');
  });

  it('escapa lo que va en la ruta', async () => {
    const { fetchImpl, calls } = createFakeFetch(() =>
      jsonResponse({ barcode: 'a b', product: null }),
    );
    await fetchProduct('a b', { fetchImpl });
    expect(calls[0]?.url).toBe('/api/off/product/a%20b');
  });
});

describe('respuestas correctas', () => {
  it('devuelve la envoltura validada de una búsqueda', async () => {
    const { fetchImpl } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    const payload = await searchProducts('leche', { fetchImpl });
    expect(payload.query).toBe('leche');
    expect(payload.count).toBe(2);
    expect(payload.products).toHaveLength(2);
  });

  it('trata un código desconocido como resultado normal, no como error', async () => {
    // Nuestra función serverless devuelve 404 con cuerpo para un código que la
    // fuente no conoce. Es una respuesta legítima: quien llama no debería tener
    // que distinguirla de un fallo de red.
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse({ barcode: '0000000000000', product: null }, { status: 404 }),
    );
    const payload = await fetchProduct('0000000000000', { fetchImpl });
    expect(payload.product).toBeNull();
  });
});

describe('errores de la API', () => {
  it('traduce el límite de ritmo con los segundos de espera', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(
        { error: { code: 'rate_limited', message: 'Demasiadas búsquedas seguidas.' } },
        { status: 429, headers: { 'retry-after': '12' } },
      ),
    );

    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OffApiError);
    expect(error).toMatchObject({
      code: 'rate_limited',
      status: 429,
      retryAfterSeconds: 12,
      message: 'Demasiadas búsquedas seguidas.',
    });
  });

  it('conserva el código que declaran nuestras propias funciones', async () => {
    const { fetchImpl } = createFakeFetch(() =>
      jsonResponse(
        { error: { code: 'upstream_timeout', message: 'Ha tardado demasiado.' } },
        { status: 504 },
      ),
    );
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'upstream_timeout', status: 504 });
  });

  it('deduce un código del estado cuando el cuerpo no es nuestro', async () => {
    // Puede pasar si algún día se cuela una página de error de la plataforma en
    // lugar de nuestra respuesta.
    const { fetchImpl } = createFakeFetch(
      () => new Response('<html>Gateway Timeout</html>', { status: 502 }),
    );
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'upstream_error', status: 502 });
  });
});

describe('nuestro propio contrato', () => {
  it('rechaza una envoltura que no cumple lo acordado', async () => {
    // Aquí el rigor es máximo a propósito: esta forma la escribimos nosotros, así
    // que un desajuste es un error nuestro y tiene que doler.
    const { fetchImpl } = createFakeFetch(() => jsonResponse({ query: 'leche' }));
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'malformed_response' });
  });

  it('rechaza un cuerpo que no es JSON', async () => {
    const { fetchImpl } = createFakeFetch(() => new Response('no soy json', { status: 200 }));
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'malformed_response' });
  });
});

describe('red y cancelación', () => {
  it('traduce un fallo de red, que es el caso de estar sin conexión', async () => {
    const { fetchImpl } = createFakeFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'network' });
    expect((error as OffApiError).cause).toBeInstanceOf(TypeError);
  });

  it('deja pasar la cancelación tal cual, sin envolverla', async () => {
    // Cancelar no es fallar. TanStack Query reconoce el `AbortError` por el
    // nombre y no lo cuenta como error; envolverlo lo convertiría en uno.
    const { fetchImpl } = createFakeFetch(() => {
      const aborted = new Error('The operation was aborted.');
      aborted.name = 'AbortError';
      throw aborted;
    });
    const error = await searchProducts('leche', { fetchImpl }).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(OffApiError);
    expect((error as Error).name).toBe('AbortError');
  });

  it('entrega la señal de cancelación al fetch', async () => {
    const controller = new AbortController();
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(SEARCH_BODY));
    await searchProducts('leche', { fetchImpl, signal: controller.signal });
    expect(calls[0]?.init?.signal).toBe(controller.signal);
  });
});
