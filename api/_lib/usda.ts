/**
 * Llamadas a USDA FoodData Central (FDC).
 *
 * Calcado de `off.ts`: mismo patrón de URL, tiempo máximo y traducción de
 * errores, porque la razón de que exista una función serverless propia es la
 * misma que D-013 ya dio para Open Food Facts (nunca hablar con la fuente
 * desde el navegador), más un motivo nuevo que OFF no tenía: **aquí sí hay un
 * secreto de verdad**. La clave de FDC no es una cabecera de cortesía, es una
 * credencial de `api.data.gov` con un cupo que se agota si se filtra.
 *
 * `api_key` viaja como parámetro de consulta porque es la única forma que
 * documenta la API (a diferencia de otras APIs, FDC no acepta una cabecera
 * `X-Api-Key` alternativa). Por eso la URL con la clave dentro **nunca sale**
 * de esta función: no se registra, no se devuelve en ningún cuerpo de error, y
 * ningún mensaje de este archivo la interpola. La única función que la usa es
 * `fetchUpstream`, y lo hace en el mismo sitio donde se construye y se
 * descarta.
 */

/*
 * La barra final importa y no es un detalle cosmético: `new URL(ruta, base)`
 * trata una `ruta` que empieza por "/" como una ruta absoluta que SUSTITUYE
 * toda la ruta de `base`, no que se añade a ella. Con `FDC_BASE` sin barra
 * final, `new URL('/food/1', FDC_BASE)` perdía el "/fdc/v1" y apuntaba a
 * `api.nal.usda.gov/food/1`, que no existe. Con la barra final y una ruta
 * relativa sin "/" inicial, si se añade correctamente. Se detectó con un test
 * que comprobaba la ruta completa, no solo que la URL fuera "parecida".
 */
const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1/';

export const UPSTREAM_TIMEOUT_MS = 5000;
export const MIN_QUERY_LENGTH = 3;
export const MAX_PAGE_SIZE = 25;

/** Nombre de la variable de entorno. El valor lo pone Vercel, nunca este repositorio. */
const API_KEY_ENV_VAR = 'USDA_API_KEY';

/**
 * Se lanza si falta la clave, en lugar de dejar que la petición salga sin ella.
 *
 * Sin esta comprobación, una función mal configurada llamaría igualmente a
 * FDC, que respondería con un error de autenticación indistinguible de
 * cualquier otro fallo del proveedor: quien lea el registro vería
 * "upstream_error" y no "falta configurar una variable de entorno en Vercel",
 * que es el problema de verdad y el que hay que poder diagnosticar rápido.
 */
export class MissingApiKeyError extends Error {
  constructor() {
    super(`Falta la variable de entorno ${API_KEY_ENV_VAR}.`);
    this.name = 'MissingApiKeyError';
  }
}

/** Lee la clave del entorno de ejecución. Lanza si no está puesta. */
export function requireApiKey(env: Record<string, string | undefined> = process.env): string {
  const key = env[API_KEY_ENV_VAR];
  if (key === undefined || key === '') {
    throw new MissingApiKeyError();
  }
  return key;
}

/** Recorta y normaliza el texto de búsqueda antes de construir la URL saliente. */
export function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function buildSearchUrl(query: string, apiKey: string, pageSize: number): string {
  const url = new URL('foods/search', FDC_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', normalizeQuery(query));
  url.searchParams.set('pageSize', String(pageSize));
  return url.toString();
}

export function buildFoodUrl(fdcId: number, apiKey: string): string {
  const url = new URL(`food/${fdcId}`, FDC_BASE);
  url.searchParams.set('api_key', apiKey);
  return url.toString();
}

/**
 * Un `fdcId` es un entero positivo. FDC no publica un formato más concreto que
 * ese (a diferencia del código de barras de OFF, que sí tiene una longitud
 * fija), así que la validación es la que se puede sostener: si no es un
 * entero positivo, no puede ser un identificador real y no hace falta
 * gastar una petición para descubrirlo.
 */
export function isValidFdcId(value: string): boolean {
  if (!/^\d+$/.test(value)) {
    return false;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0;
}

/** El `retry-after` de la fuente, en segundos, si viene y es un número usable. */
function upstreamRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (raw === null) {
    return undefined;
  }
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

export interface UpstreamResult {
  readonly status: number;
  readonly body: unknown;
  readonly retryAfterSeconds?: number;
}

/**
 * Llamada a FDC con tiempo máximo.
 *
 * A diferencia de `fetchUpstream` de OFF, aquí no hace falta una cabecera de
 * identificación propia: la clave de la URL ya identifica la aplicación ante
 * `api.data.gov`, que es justo lo que la cabecera `User-Agent` de OFF hacía a
 * mano por no tener ese sistema.
 */
export async function fetchUpstream(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamResult> {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const retryAfterSeconds = upstreamRetryAfter(response);
    return {
      status: response.status,
      body: null,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    };
  }

  return { status: response.status, body: await response.json() };
}
