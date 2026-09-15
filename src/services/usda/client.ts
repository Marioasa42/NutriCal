import {
  apiErrorSchema,
  usdaFoodPayloadSchema,
  usdaSearchPayloadSchema,
  type API_ERROR_CODES,
  type UsdaFoodPayload,
  type UsdaSearchPayload,
} from '@/services/usda/schemas';
import { normalizeForSearch } from '@contracts/text';

/**
 * El único punto del navegador que habla por red con `/api/usda`.
 *
 * Calcado de `services/off/client.ts`: la razón de existir es la misma
 * (D-013, D-047) y el vocabulario de error es literalmente el mismo
 * (`shared/api-error.ts`), así que reaparecen aquí el mismo error tipado, la
 * misma comprobación de sincronía en tiempo de compilación y la misma
 * distinción entre nuestro cubo y el de la fuente.
 */

const API_BASE = '/api/usda';

/**
 * Los fallos que este cliente sabe nombrar. Ver `OffErrorCode` en
 * `off/client.ts`: la lista es idéntica porque las dos fuentes comparten
 * `api/_lib/http.ts`, y solo se repite aquí (en vez de importarse) porque cada
 * cliente lanza y captura su propia clase de error, con su propio nombre en
 * `code`, y unir las dos por un tipo común habría ligado el manejo de errores
 * de una fuente al de la otra sin necesidad.
 */
export type UsdaErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'server_misconfigured'
  | 'network'
  | 'malformed_response';

/**
 * Red de seguridad: esta unión y `API_ERROR_CODES` no se pueden desincronizar.
 * Ver la explicación larga en `off/client.ts`; aquí se repite el mismo patrón
 * porque el riesgo (añadir un código a un lado y olvidar el otro) es el mismo
 * riesgo, no uno parecido.
 */
type Expect<T extends true> = T;
type SameMembers<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { sobranEnElEsquemaDeZod: Exclude<B, A> }
  : { faltanEnElEsquemaDeZod: Exclude<A, B> };

type ClientOnlyErrorCode = 'network' | 'malformed_response';

export type UsdaErrorCodesAreInSync = Expect<
  SameMembers<UsdaErrorCode, (typeof API_ERROR_CODES)[number] | ClientOnlyErrorCode>
>;

/** Error tipado del cliente. Ver `OffApiError`: mismo motivo para cada decisión de diseño. */
export class UsdaApiError extends Error {
  readonly code: UsdaErrorCode;
  readonly status: number | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: UsdaErrorCode,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'UsdaApiError';
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) {
    return undefined;
  }
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

async function errorFromResponse(response: Response): Promise<UsdaApiError> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
  const shared = {
    status: response.status,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new UsdaApiError(parsed.data.error.code, parsed.data.error.message, shared);
  }

  const code: UsdaErrorCode = response.status === 429 ? 'rate_limited' : 'upstream_error';
  return new UsdaApiError(code, `La API ha respondido con el estado ${response.status}.`, shared);
}

async function getJson(path: string, options: RequestOptions): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  } catch (error) {
    if (isAbort(error)) {
      throw error;
    }
    throw new UsdaApiError('network', 'No se ha podido contactar con el servidor.', {
      cause: error,
    });
  }

  if (!response.ok && response.status !== 404) {
    throw await errorFromResponse(response);
  }

  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new UsdaApiError('malformed_response', 'La respuesta no era JSON válido.', {
      status: response.status,
      cause: error,
    });
  }
}

function parseEnvelope<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new UsdaApiError(
      'malformed_response',
      'La respuesta de la API no tiene la forma acordada.',
    );
  }
  return parsed.data;
}

/**
 * Búsqueda por texto en USDA FoodData Central.
 *
 * El texto sale normalizado (recortado, en minúsculas y sin diacríticos) por
 * el mismo motivo que en `off/client.ts` pese a que el límite de ritmo de
 * FDC no comparte el problema de D-013 (aquí el cupo es por clave de API, no
 * por dirección IP repartida): la caché de la red de distribución de Vercel
 * indexa por la URL de ESTA función, `/api/usda/search?q=...`, así que
 * "Plátano" y "platano" siguen mereciendo la misma entrada de caché para no
 * gastar dos veces el mismo cupo por el mismo texto.
 */
export async function searchUsdaFoods(
  query: string,
  options: RequestOptions = {},
): Promise<UsdaSearchPayload> {
  const params = new URLSearchParams({ q: normalizeForSearch(query) });
  const body = await getJson(`/search?${params.toString()}`, options);
  return parseEnvelope(usdaSearchPayloadSchema, body);
}

/**
 * Ficha completa de un alimento por su `fdcId`.
 *
 * Es la llamada que trae el panel de micronutrientes: `searchUsdaFoods` no lo
 * trae (D-048). Un `fdcId` que FDC no conoce es un `null` normal, no un
 * error, igual que un código de barras que OFF no conoce.
 */
export async function fetchUsdaFood(
  fdcId: number,
  options: RequestOptions = {},
): Promise<UsdaFoodPayload> {
  const body = await getJson(`/food/${encodeURIComponent(String(fdcId))}`, options);
  return parseEnvelope(usdaFoodPayloadSchema, body);
}
