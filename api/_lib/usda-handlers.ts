import {
  CACHE_NOT_FOUND,
  CACHE_PRODUCT,
  CACHE_SEARCH,
  errorResponse,
  jsonResponse,
  methodNotAllowed,
} from './http.js';
import type { TokenBucket } from './rate-limit.js';
import {
  MAX_PAGE_SIZE,
  MIN_QUERY_LENGTH,
  MissingApiKeyError,
  buildFoodUrl,
  buildSearchUrl,
  fetchUpstream,
  isValidFdcId,
  normalizeQuery,
  requireApiKey,
} from './usda.js';

/**
 * La lógica de los dos endpoints de USDA, con sus dependencias por parámetro.
 *
 * Mismo patrón que `handlers.ts` para Open Food Facts, y vive en su propio
 * archivo en lugar de crecer dentro de aquel: son dos fuentes externas
 * distintas, con su propio vocabulario de campos y de errores por debajo, y
 * juntarlas en un archivo habría mezclado dos cosas que cambian por motivos
 * distintos.
 *
 * Reutiliza el vocabulario de errores de `http.ts` (`ErrorCode`,
 * `jsonResponse`, `errorResponse`) y las cabeceras de caché, porque el trato
 * con el navegador es el mismo trato sea cual sea la fuente: un producto que
 * no existe es un 404 con cuerpo `null`, un límite de la fuente es
 * `upstream_rate_limited`, y así con el resto (D-040).
 */
export interface UsdaHandlerDeps {
  readonly bucket: TokenBucket;
  readonly now: () => number;
  readonly fetchImpl: typeof fetch;
  /** Solo para tests: sustituye `process.env` sin tocar variables globales. */
  readonly env?: Record<string, string | undefined>;
}

/** Distingue un tiempo agotado de un fallo cualquiera de la red. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** Igual que en D-040 para Open Food Facts: su ventana documentada es una hora. */
const UPSTREAM_RATE_LIMIT_FALLBACK_SECONDS = 3600;

function upstreamRateLimited(retryAfterSeconds: number | undefined): Response {
  const seconds = retryAfterSeconds ?? UPSTREAM_RATE_LIMIT_FALLBACK_SECONDS;
  return errorResponse(
    429,
    'upstream_rate_limited',
    'USDA FoodData Central ha limitado el ritmo de consultas. Hay que esperar antes de volver a buscar.',
    { 'retry-after': String(seconds) },
  );
}

/**
 * Falta o está rota la configuración del entorno de ejecución: un problema
 * de despliegue, no de quien busca. El mensaje que llega al navegador no dice
 * el nombre de la variable ni ningún detalle interno; ese detalle se queda en
 * los registros del servidor, nunca en la respuesta HTTP.
 *
 * `server_misconfigured` es un código propio, distinto de `upstream_error`
 * (D-056): ese dice "la fuente ha fallado, prueba en un momento", que aquí
 * sería mentira. Un despliegue mal configurado no se arregla reintentando, y
 * decir lo contrario le hace perder el tiempo a quien lo lee.
 */
function serverMisconfigured(): Response {
  return errorResponse(
    500,
    'server_misconfigured',
    'El servidor no está configurado correctamente. No es un fallo de USDA FoodData Central: hace falta corregir el despliegue.',
  );
}

/**
 * Resuelve la clave de API, con un único camino de fallo.
 *
 * D-056: antes, este paso solo capturaba `MissingApiKeyError` y dejaba pasar
 * cualquier otra excepción sin capturar -en producción, un `ReferenceError`
 * si `process` no existe en el entorno de ejecución de la función revienta
 * la función entera con un 500 desnudo en unos pocos milisegundos, antes de
 * intentar nada por red, y ESE 500 no lleva el cuerpo JSON que el resto de
 * esta API promete, así que el cliente ni siquiera puede reconocerlo como un
 * error nuestro. La regla ahora es: cualquier fallo al leer la
 * configuración, sea cual sea, es un problema de servidor, nunca un 500
 * suelto. Se registra el detalle real en el servidor -distinguiendo la causa
 * conocida de una inesperada- y se devuelve siempre la misma respuesta
 * controlada.
 */
function resolveApiKey(
  env: UsdaHandlerDeps['env'],
): { kind: 'ok'; apiKey: string } | { kind: 'error' } {
  try {
    return { kind: 'ok', apiKey: requireApiKey(env) };
  } catch (error) {
    console.error(
      error instanceof MissingApiKeyError
        ? error.message
        : 'USDA: fallo inesperado al leer la configuración del servidor.',
      error,
    );
    return { kind: 'error' };
  }
}

export interface UsdaSearchPayload {
  readonly query: string;
  readonly foods: readonly unknown[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function extractFoods(body: unknown): readonly unknown[] {
  if (!isRecord(body)) {
    return [];
  }
  return Array.isArray(body.foods) ? body.foods : [];
}

export async function handleUsdaSearch(request: Request, deps: UsdaHandlerDeps): Promise<Response> {
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

  const resolved = resolveApiKey(deps.env);
  if (resolved.kind === 'error') {
    return serverMisconfigured();
  }
  const { apiKey } = resolved;

  const now = deps.now();
  if (!deps.bucket.tryTake(now)) {
    return errorResponse(
      429,
      'rate_limited',
      'Demasiadas búsquedas seguidas. Prueba en unos segundos.',
      { 'retry-after': String(deps.bucket.retryAfterSeconds(now)) },
    );
  }

  try {
    const upstream = await fetchUpstream(
      buildSearchUrl(query, apiKey, MAX_PAGE_SIZE),
      deps.fetchImpl,
    );
    if (upstream.status === 429) {
      return upstreamRateLimited(upstream.retryAfterSeconds);
    }
    if (upstream.status !== 200) {
      return errorResponse(
        502,
        'upstream_error',
        'USDA FoodData Central no ha respondido correctamente.',
      );
    }

    const payload: UsdaSearchPayload = { query, foods: extractFoods(upstream.body) };
    return jsonResponse(payload, { cacheControl: CACHE_SEARCH });
  } catch (error) {
    return isTimeout(error)
      ? errorResponse(504, 'upstream_timeout', 'USDA FoodData Central ha tardado demasiado.')
      : errorResponse(502, 'upstream_error', 'No se ha podido consultar USDA FoodData Central.');
  }
}

/** Extrae el fdcId del último segmento de la ruta. */
export function fdcIdFromUrl(rawUrl: string): string {
  const segments = new URL(rawUrl).pathname.split('/').filter((segment) => segment !== '');
  return segments.at(-1) ?? '';
}

export async function handleUsdaFood(request: Request, deps: UsdaHandlerDeps): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed();
  }

  const raw = fdcIdFromUrl(request.url);
  if (!isValidFdcId(raw)) {
    return errorResponse(
      400,
      'invalid_request',
      'El identificador de FDC debe ser un número entero positivo.',
    );
  }
  const fdcId = Number.parseInt(raw, 10);

  const resolved = resolveApiKey(deps.env);
  if (resolved.kind === 'error') {
    return serverMisconfigured();
  }
  const { apiKey } = resolved;

  const now = deps.now();
  if (!deps.bucket.tryTake(now)) {
    return errorResponse(
      429,
      'rate_limited',
      'Demasiadas consultas seguidas. Prueba en unos segundos.',
      { 'retry-after': String(deps.bucket.retryAfterSeconds(now)) },
    );
  }

  try {
    const upstream = await fetchUpstream(buildFoodUrl(fdcId, apiKey), deps.fetchImpl);

    if (upstream.status === 429) {
      return upstreamRateLimited(upstream.retryAfterSeconds);
    }

    // FDC responde 404 para un fdcId que no conoce. Igual que en OFF, no es un
    // fallo: es una respuesta legítima que conviene cachear un rato.
    if (upstream.status === 404) {
      return jsonResponse({ fdcId, food: null }, { status: 404, cacheControl: CACHE_NOT_FOUND });
    }
    if (upstream.status !== 200) {
      return errorResponse(
        502,
        'upstream_error',
        'USDA FoodData Central no ha respondido correctamente.',
      );
    }

    return jsonResponse({ fdcId, food: upstream.body }, { cacheControl: CACHE_PRODUCT });
  } catch (error) {
    return isTimeout(error)
      ? errorResponse(504, 'upstream_timeout', 'USDA FoodData Central ha tardado demasiado.')
      : errorResponse(502, 'upstream_error', 'No se ha podido consultar USDA FoodData Central.');
  }
}
