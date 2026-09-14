import {
  type API_ERROR_CODES,
  apiErrorSchema,
  productPayloadSchema,
  searchPayloadSchema,
  type ProductPayload,
  type SearchPayload,
} from '@/services/off/schemas';
import { normalizeForSearch } from '@contracts/text';

/**
 * El único punto del navegador que habla por red con nuestra API.
 *
 * Solo con la nuestra: en este archivo no aparece el dominio de Open Food Facts
 * por ninguna parte, y no debe aparecer nunca. Si lo hiciera, la cabecera de
 * identificación, el límite de ritmo y la caché compartida de la decisión D-013
 * se quedarían sin efecto para esa llamada.
 */

const API_BASE = '/api/off';

/**
 * Los fallos que este cliente sabe nombrar.
 *
 * Los seis primeros son los que ya produce `api/_lib/http.ts`, así que el
 * frontend y las funciones serverless hablan del mismo vocabulario. Los dos
 * últimos solo pueden ocurrir aquí: `network` cuando la petición ni sale, que es
 * el caso de estar sin conexión, y `malformed_response` cuando la respuesta no
 * cumple nuestro propio contrato, que es un fallo nuestro.
 *
 * `rate_limited` es nuestro cubo y `upstream_rate_limited` es el de Open Food
 * Facts. Ninguno de los dos se reintenta, pero son distintos y hay que poder
 * verlos por separado en los registros (D-040).
 */
export type OffErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'rate_limited'
  | 'upstream_rate_limited'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'network'
  | 'malformed_response';

/**
 * Red de seguridad: esta unión y la lista de Zod no se pueden desincronizar.
 *
 * Es el mismo patrón que `macros.ts` usa para atar `REQUIRED_MACRO_KEYS` a
 * `Macros`, y aquí lo pide un caso real. Al añadir `upstream_rate_limited`
 * (D-040) se tocó esta unión y se olvidó `API_ERROR_CODES`, que es una lista
 * cerrada de Zod. El resultado no habría sido un error ruidoso sino uno
 * silencioso: la envoltura no habría validado, y `errorFromResponse` se habría
 * caído a adivinar el código por el estado HTTP, poniéndole al error el nombre
 * equivocado. Un fallo así solo se ve leyendo los registros y desconfiando de
 * ellos.
 *
 * Comparar en las dos direcciones (`A extends B` y `B extends A`) es lo que hace
 * que falle tanto si sobra un código como si falta. Con una sola dirección, la
 * mitad de los descuidos pasaría. Los corchetes de `[A] extends [B]` evitan que
 * TypeScript reparta la comprobación miembro a miembro de la unión, que es su
 * comportamiento por defecto y aquí daría un resultado inútil.
 */
type Expect<T extends true> = T;
type SameMembers<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : { sobranEnElEsquemaDeZod: Exclude<B, A> }
  : { faltanEnElEsquemaDeZod: Exclude<A, B> };

/** Los dos que solo existen en el navegador: nunca los produce una función. */
type ClientOnlyErrorCode = 'network' | 'malformed_response';

export type OffErrorCodesAreInSync = Expect<
  SameMembers<OffErrorCode, (typeof API_ERROR_CODES)[number] | ClientOnlyErrorCode>
>;

/**
 * Error tipado del cliente.
 *
 * Se lanza en lugar de devolverse porque es lo que TanStack Query espera de
 * forma nativa en el paso siguiente: lo que se lanza acaba en `error` y lo que se
 * devuelve acaba en `data`. Un producto que no existe NO viaja por aquí: eso es
 * un `null` normal, no un fallo.
 *
 * Los campos se asignan en el cuerpo del constructor en lugar de declararse como
 * parámetros con modificador, porque `erasableSyntaxOnly` está activado: solo se
 * admite sintaxis que se pueda borrar para obtener JavaScript, y las propiedades
 * de parámetro generan código.
 */
export class OffApiError extends Error {
  readonly code: OffErrorCode;
  /** El estado HTTP, si llegó a haber respuesta. */
  readonly status: number | undefined;
  /** Segundos que pide esperar el servidor, solo en los dos límites de ritmo. */
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: OffErrorCode,
    message: string,
    options: { status?: number; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'OffApiError';
    this.code = code;
    this.status = options.status;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/**
 * Opciones comunes de cualquier llamada.
 *
 * `fetchImpl` sigue el mismo patrón que las funciones serverless: la dependencia
 * entra por parámetro para que los tests pasen un doble en lugar de sustituir una
 * variable global y tener que acordarse de restaurarla.
 */
export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}

/** Un `AbortError` se deja pasar tal cual: cancelar no es fallar. */
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

/**
 * Traduce una respuesta de error de nuestra API a un `OffApiError`.
 *
 * Si el cuerpo trae el código que nuestras funciones prometen, se usa ese. Si no,
 * se cae a un código deducido del estado HTTP: puede pasar si algún día se cuela
 * una página de error de la plataforma en lugar de nuestra respuesta.
 */
async function errorFromResponse(response: Response): Promise<OffApiError> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
  const shared = {
    status: response.status,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };

  const body: unknown = await response.json().catch(() => undefined);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    return new OffApiError(parsed.data.error.code, parsed.data.error.message, shared);
  }

  // Ante la duda, el código que NO se reintenta. Si un 429 llega sin cuerpo
  // reconocible no sabemos de quién es el límite, pero sí sabemos que insistir lo
  // empeora, así que se elige el que frena (D-040).
  const code: OffErrorCode = response.status === 429 ? 'rate_limited' : 'upstream_error';
  return new OffApiError(code, `La API ha respondido con el estado ${response.status}.`, shared);
}

/** Petición al intermediario y validación de la envoltura, sin interpretar aún el contenido. */
async function getJson(path: string, options: RequestOptions): Promise<unknown> {
  const doFetch = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${API_BASE}${path}`, {
      headers: { accept: 'application/json' },
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
    });
  } catch (error) {
    // La cancelación sube intacta. TanStack Query la reconoce por el nombre y no
    // la trata como un fallo; envolverla la convertiría en un error de verdad.
    if (isAbort(error)) {
      throw error;
    }
    throw new OffApiError('network', 'No se ha podido contactar con el servidor.', {
      cause: error,
    });
  }

  if (!response.ok && response.status !== 404) {
    throw await errorFromResponse(response);
  }

  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new OffApiError('malformed_response', 'La respuesta no era JSON válido.', {
      status: response.status,
      cause: error,
    });
  }
}

/**
 * Valida contra nuestro propio contrato.
 *
 * Aquí el rigor es máximo a propósito: esta forma la escribimos nosotros en
 * `api/_lib/handlers.ts`, así que un desajuste es un error nuestro y tiene que
 * doler. La permisividad se reserva para el producto de dentro, que lo escribe
 * una fuente externa.
 */
function parseEnvelope<T>(
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
  body: unknown,
): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new OffApiError(
      'malformed_response',
      'La respuesta de la API no tiene la forma acordada.',
    );
  }
  return parsed.data;
}

/**
 * Búsqueda por texto.
 *
 * Devuelve los productos sin interpretar: convertirlos en alimentos es trabajo de
 * `normalize.ts`, que es código puro y se prueba sin tocar la red.
 */
export async function searchProducts(
  query: string,
  options: RequestOptions & { page?: number } = {},
): Promise<SearchPayload> {
  // El texto sale normalizado, no crudo, y esto no es cosmética: la URL ES la
  // clave con la que la red de distribución de Vercel guarda la respuesta.
  // Mandando el texto tal cual, "Plátano", "platano" y "  PLÁTANO  " producían
  // tres entradas de caché distintas para el mismo término y tres fallos de
  // caché, mientras el comentario de `contracts/text.ts` afirmaba lo contrario
  // (D-041). La función serverless ya normalizaba por dentro, pero eso llega
  // tarde: la caché y el cubo de fichas quedan por delante de ella.
  const params = new URLSearchParams({ q: normalizeForSearch(query) });
  if (options.page !== undefined) {
    params.set('page', String(options.page));
  }
  const body = await getJson(`/search?${params.toString()}`, options);
  return parseEnvelope(searchPayloadSchema, body);
}

/**
 * Consulta por código de barras.
 *
 * El 404 no es un error: es la respuesta correcta a un código que la fuente no
 * conoce, y nuestra función serverless ya lo devuelve con cuerpo
 * `{ barcode, product: null }` justamente para que aquí se pueda tratar como un
 * resultado normal. Lanzar en ese caso obligaría a quien llama a distinguir un
 * fallo real de una respuesta perfectamente válida.
 */
export async function fetchProduct(
  barcode: string,
  options: RequestOptions = {},
): Promise<ProductPayload> {
  const body = await getJson(`/product/${encodeURIComponent(barcode)}`, options);
  return parseEnvelope(productPayloadSchema, body);
}
