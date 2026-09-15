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

/**
 * Lee la clave del entorno de ejecución. Lanza si no está puesta.
 *
 * Ya no lleva `env: ... = process.env` como parámetro por defecto. Ese
 * valor por defecto se evalúa en el sitio donde se llama, ANTES de entrar
 * al cuerpo de esta función: si `process` no existiera como global en el
 * entorno de ejecución, la propia evaluación del valor por defecto lanzaría
 * un `ReferenceError` antes de que hubiera una sola línea de este archivo
 * corriendo, y ningún registro de diagnóstico de aquí dentro llegaría a
 * imprimirse. `typeof process` en cambio nunca lanza, exista `process` o
 * no: es la única forma segura de preguntarlo (D-058, D-059).
 *
 * El bloque de trazas es diagnóstico temporal para el incidente de D-058:
 * quitar en cuanto los registros de un despliegue real expliquen la causa.
 * Nunca imprime el valor de la clave, solo si está presente y cuántos
 * caracteres tiene.
 */
export function requireApiKey(env?: Record<string, string | undefined>): string {
  const hasProcess = typeof process !== 'undefined';
  // Los tipos ambientales de Node dan por hecho que si `process` existe,
  // `process.env` es siempre un objeto real. Ese es exactamente el supuesto
  // que este diagnóstico existe para poner a prueba en un entorno de
  // ejecución real, así que la condición se comprueba en tiempo de
  // ejecución aunque el compilador la dé por segura.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const hasProcessEnv = hasProcess && typeof process.env === 'object' && process.env !== null;
  const source: Record<string, string | undefined> | undefined =
    env ?? (hasProcessEnv ? process.env : undefined);

  const rawValue = source?.[API_KEY_ENV_VAR];

  console.log(
    '[USDA][diagnostico-clave]',
    JSON.stringify({
      envParamProvided: env !== undefined,
      hasProcess,
      hasProcessEnv,
      sourceIsDefined: source !== undefined,
      sourceKeyCount: source === undefined ? null : Object.keys(source).length,
      keyName: API_KEY_ENV_VAR,
      keyPresent: rawValue !== undefined && rawValue !== '',
      keyLength: rawValue === undefined ? null : rawValue.length,
      nodeEnv: hasProcessEnv ? (process.env.NODE_ENV ?? null) : null,
      vercelEnv: hasProcessEnv ? (process.env.VERCEL_ENV ?? null) : null,
    }),
  );

  if (rawValue === undefined || rawValue === '') {
    throw new MissingApiKeyError();
  }
  return rawValue;
}

/** Recorta y normaliza el texto de búsqueda antes de construir la URL saliente. */
export function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Los únicos tipos de dato que USDA debe buscar, y por qué son estos dos y no
 * los cuatro que existen.
 *
 * Comprobado contra la API real, no a ojo: `query=apple` sin filtrar da
 * 25.709 resultados, y los tres primeros son "Branded" (productos de marca).
 * Es justo el terreno que ya cubre Open Food Facts, y lo cubre mejor: es su
 * especialidad. Con `dataType=Foundation,SR Legacy`, la misma búsqueda cae a
 * 95 resultados y las tres primeras son manzanas de verdad ("Apples, fuji,
 * with skin, raw"; "Apples, gala..."; "Apples, raw, without skin"). El mismo
 * patrón se repitió con "broccoli". Sin este filtro, USDA no aporta nada que
 * OFF no tuviera ya: duplica en vez de completar, que era el motivo entero
 * de añadirlo (D-048).
 *
 * "Survey (FNDDS)" se deja fuera a propósito: es la base de encuestas
 * dietéticas, con entradas de plato preparado ("Apple pie filling", "Carrots,
 * raw, salad with apples"), no de ingrediente suelto. No es lo que faltaba
 * cubrir.
 *
 * Esto no es un ajuste de relevancia que se pueda desactivar: es la
 * definición de qué papel juega USDA en el proyecto. Por eso no es un
 * parámetro de `buildSearchUrl`, sino una constante fijada aquí dentro: no
 * existe ninguna llamada a esta función que pueda construir una URL sin el
 * filtro puesto.
 */
const SEARCH_DATA_TYPES = ['Foundation', 'SR Legacy'] as const;

export function buildSearchUrl(query: string, apiKey: string, pageSize: number): string {
  const url = new URL('foods/search', FDC_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('query', normalizeQuery(query));
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('dataType', SEARCH_DATA_TYPES.join(','));
  return url.toString();
}

/**
 * `format=abridged` no es un ahorro de peso: es lo que hace que la respuesta se
 * pueda leer.
 *
 * Se comprobó contra la API real, no en la documentación: sin este parámetro,
 * el formato por defecto ("full") da un `foodNutrients[]` cuya forma depende
 * del tipo de dato de la fuente y que para los alimentos de marca ("Branded",
 * que son la mayoría de lo que trae una búsqueda) **no lleva el número de
 * nutriente en ningún sitio**, solo un identificador de fila interno y la
 * cantidad. Sin ese número no hay manera de saber si una cifra es la vitamina
 * C o el sodio. Con `format=abridged`, la fuente devuelve siempre la misma
 * forma plana (`{ number, name, amount, unitName }`), igual para un alimento
 * de marca que para uno de la base de datos histórica del USDA. Sin este
 * parámetro, el cliente de la fase 2 que lee `number` para saber qué
 * nutriente es cada cifra se quedaría ciego justo en el caso más común.
 */
export function buildFoodUrl(fdcId: number, apiKey: string): string {
  const url = new URL(`food/${fdcId}`, FDC_BASE);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'abridged');
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
