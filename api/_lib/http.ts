/**
 * Respuestas HTTP de nuestra API.
 *
 * Toda la caché vive aquí delante de la función, no dentro. Una función
 * serverless no conserva estado entre invocaciones, así que el sitio donde
 * guardar la respuesta es la red de distribución, que la indexa por URL y la
 * comparte entre todos los visitantes. Ver la decisión D-013.
 *
 * `s-maxage` lo entienden las cachés compartidas, no el navegador.
 * `stale-while-revalidate` permite servir la copia caducada al instante mientras
 * se refresca por detrás, de modo que ni siquiera la primera petición tras
 * caducar espera a la red.
 */
export const CACHE_PRODUCT = 'public, s-maxage=86400, stale-while-revalidate=604800';
export const CACHE_SEARCH = 'public, s-maxage=600, stale-while-revalidate=3600';
/** Caché negativa corta: evita reintentar en bucle un código que no existe. */
export const CACHE_NOT_FOUND = 'public, s-maxage=300';
/** Los errores no se cachean nunca: el siguiente intento debe poder funcionar. */
export const CACHE_NONE = 'no-store';

export type ErrorCode =
  'invalid_request' | 'not_found' | 'rate_limited' | 'upstream_error' | 'upstream_timeout';

export interface ApiError {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
  };
}

export function jsonResponse(
  body: unknown,
  options: { status?: number; cacheControl?: string; headers?: Record<string, string> } = {},
): Response {
  const { status = 200, cacheControl = CACHE_NONE, headers = {} } = options;
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
      ...headers,
    },
  });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  const body: ApiError = { error: { code, message } };
  return jsonResponse(body, { status, cacheControl: CACHE_NONE, headers });
}

/** Solo aceptamos lecturas. Cualquier otro método se rechaza sin tocar la red. */
export function methodNotAllowed(): Response {
  return errorResponse(405, 'invalid_request', 'Solo se admite GET.', { allow: 'GET' });
}
