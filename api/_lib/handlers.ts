import {
  CACHE_NOT_FOUND,
  CACHE_PRODUCT,
  CACHE_SEARCH,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
} from './http.js';
import {
  MIN_QUERY_LENGTH,
  buildProductUrl,
  buildSearchUrl,
  fetchUpstream,
  isValidBarcode,
  normalizeQuery,
  parsePage,
} from './off.js';
import type { TokenBucket } from './rate-limit.js';

/**
 * La lógica de los dos endpoints, con sus dependencias por parámetro.
 *
 * Los archivos de ruta son adaptadores de tres líneas. Toda la decisión vive
 * aquí, donde se puede probar pasando una petición y mirando la respuesta, sin
 * levantar un servidor ni sustituir variables globales.
 */
export interface HandlerDeps {
  readonly bucket: TokenBucket;
  readonly now: () => number;
  readonly fetchImpl: typeof fetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Nuestra respuesta de búsqueda. Es un contrato propio, no el de Open Food Facts. */
export interface SearchPayload {
  readonly query: string;
  readonly page: number;
  readonly count: number;
  readonly products: readonly unknown[];
}

function extractSearch(body: unknown): { count: number; products: readonly unknown[] } {
  if (!isRecord(body)) {
    return { count: 0, products: [] };
  }
  const products = Array.isArray(body.products) ? body.products : [];
  const count = typeof body.count === 'number' ? body.count : products.length;
  return { count, products };
}

function extractProduct(body: unknown): unknown {
  if (!isRecord(body) || body.status !== 1) {
    return undefined;
  }
  return isRecord(body.product) ? body.product : undefined;
}

/** Distingue un tiempo agotado de un fallo cualquiera de la red. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/**
 * Cuánto decimos que hay que esperar cuando la fuente nos limita y no lo dice
 * ella. Su ventana documentada es de un minuto, así que esperar eso es lo
 * prudente: pasarse de corto es volver a llamar a una puerta que acaban de
 * cerrarnos.
 */
const UPSTREAM_RATE_LIMIT_FALLBACK_SECONDS = 60;

/**
 * La respuesta a que Open Food Facts nos limite el ritmo.
 *
 * Se devuelve con 429 y con su propio código, no con el 502 genérico de "la
 * fuente ha respondido mal". El motivo está medido y documentado en D-040: al
 * mezclarlo con `upstream_error`, el navegador lo trataba como un fallo pasajero
 * y lo reintentaba dos veces, de modo que cada rechazo de la fuente producía tres
 * peticiones más contra la fuente. Justo lo contrario de lo que hay que hacer
 * cuando alguien te dice que pares.
 */
function upstreamRateLimited(retryAfterSeconds: number | undefined): Response {
  const seconds = retryAfterSeconds ?? UPSTREAM_RATE_LIMIT_FALLBACK_SECONDS;
  return errorResponse(
    429,
    'upstream_rate_limited',
    'Open Food Facts ha limitado el ritmo de consultas. Hay que esperar antes de volver a buscar.',
    { 'retry-after': String(seconds) },
  );
}

export async function handleSearch(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const params = new URL(request.url).searchParams;
  const query = normalizeQuery(params.get('q') ?? '');
  if (query.length < MIN_QUERY_LENGTH) {
    return errorResponse(
      400,
      'invalid_request',
      `El parámetro q necesita al menos ${MIN_QUERY_LENGTH} caracteres.`,
    );
  }

  const page = parsePage(params.get('page'));
  const now = deps.now();
  if (!deps.bucket.tryTake(now)) {
    return errorResponse(
      429,
      'rate_limited',
      'Demasiadas búsquedas seguidas. Prueba en unos segundos.',
      {
        'retry-after': String(deps.bucket.retryAfterSeconds(now)),
      },
    );
  }

  try {
    const upstream = await fetchUpstream(buildSearchUrl(query, page), deps.fetchImpl);
    if (upstream.status === 429) {
      return upstreamRateLimited(upstream.retryAfterSeconds);
    }
    if (upstream.status !== 200) {
      return errorResponse(
        502,
        'upstream_error',
        'Open Food Facts no ha respondido correctamente.',
      );
    }

    const { count, products } = extractSearch(upstream.body);
    const payload: SearchPayload = { query, page, count, products };
    return jsonResponse(payload, { cacheControl: CACHE_SEARCH });
  } catch (error) {
    return isTimeout(error)
      ? errorResponse(504, 'upstream_timeout', 'Open Food Facts ha tardado demasiado.')
      : errorResponse(502, 'upstream_error', 'No se ha podido consultar Open Food Facts.');
  }
}

/** Extrae el código de barras del último segmento de la ruta. */
export function barcodeFromUrl(rawUrl: string): string {
  const segments = new URL(rawUrl).pathname.split('/').filter((segment) => segment !== '');
  return segments.at(-1) ?? '';
}

export async function handleProduct(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const barcode = barcodeFromUrl(request.url);
  if (!isValidBarcode(barcode)) {
    return errorResponse(
      400,
      'invalid_request',
      'El código de barras debe tener entre 8 y 14 dígitos.',
    );
  }

  const now = deps.now();
  if (!deps.bucket.tryTake(now)) {
    return errorResponse(
      429,
      'rate_limited',
      'Demasiadas consultas seguidas. Prueba en unos segundos.',
      {
        'retry-after': String(deps.bucket.retryAfterSeconds(now)),
      },
    );
  }

  try {
    const upstream = await fetchUpstream(buildProductUrl(barcode), deps.fetchImpl);

    if (upstream.status === 429) {
      return upstreamRateLimited(upstream.retryAfterSeconds);
    }

    // Open Food Facts responde 404 para un código que no conoce. No es un fallo
    // nuestro ni suyo: es una respuesta legítima que conviene cachear un rato.
    if (upstream.status === 404) {
      return jsonResponse(
        { barcode, product: null },
        { status: 404, cacheControl: CACHE_NOT_FOUND },
      );
    }
    if (upstream.status !== 200) {
      return errorResponse(
        502,
        'upstream_error',
        'Open Food Facts no ha respondido correctamente.',
      );
    }

    const product = extractProduct(upstream.body);
    if (product === undefined) {
      return jsonResponse(
        { barcode, product: null },
        { status: 404, cacheControl: CACHE_NOT_FOUND },
      );
    }

    return jsonResponse({ barcode, product }, { cacheControl: CACHE_PRODUCT });
  } catch (error) {
    return isTimeout(error)
      ? errorResponse(504, 'upstream_timeout', 'Open Food Facts ha tardado demasiado.')
      : errorResponse(502, 'upstream_error', 'No se ha podido consultar Open Food Facts.');
  }
}
