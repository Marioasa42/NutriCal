import { normalizeForSearch } from './text.js';

/*
 * Nota sobre las importaciones con extensión `.js`: este proyecto se ejecuta como
 * módulos de Node, no pasa por el empaquetador de Vite. En módulos de Node la
 * ruta de importación es la del archivo que existirá en tiempo de ejecución, que
 * es JavaScript, aunque aquí estemos escribiendo TypeScript.
 */

export const APP_VERSION = '0.1.0';

/**
 * Open Food Facts exige identificarse con nombre de aplicación, versión y una
 * forma de contacto. El navegador no permite fijar esta cabecera desde
 * JavaScript, y ese es el motivo por el que esta función existe.
 *
 * Como contacto va la URL del repositorio y no un correo personal: cumple el
 * requisito sin publicar una dirección en un repositorio público.
 */
export const USER_AGENT = `NutriCal/${APP_VERSION} (+https://github.com/Marioasa42/NutriCal)`;

const OFF_BASE = 'https://world.openfoodfacts.org';

/**
 * Solo pedimos los campos que usamos. Reduce el peso de la respuesta, acelera la
 * petición y hace más barata la entrada de caché.
 */
export const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
  'nutrition_data_per',
  'image_front_small_url',
] as const;

const FIELDS_PARAM = PRODUCT_FIELDS.join(',');

export const MAX_PAGE = 20;
export const PAGE_SIZE = 20;
export const MIN_QUERY_LENGTH = 3;
export const UPSTREAM_TIMEOUT_MS = 5000;

/**
 * La validación del código de barras se reexporta desde `contracts/`, que es
 * donde vive ahora la única definición.
 *
 * Se reexporta en lugar de obligar a `handlers.ts` a importar de dos sitios:
 * para quien lee los manejadores, la regla sigue llegando de donde llegaba. Y
 * validar antes de construir la URL no es una formalidad, sin esto cualquier
 * texto acabaría dentro de la ruta de una petición saliente.
 */
export { isValidBarcode } from '../../contracts/barcode.js';

/** Normaliza la consulta para que dos escrituras equivalentes compartan caché. */
export function normalizeQuery(value: string): string {
  return normalizeForSearch(value);
}

export function buildSearchUrl(query: string, page: number): string {
  const url = new URL('/cgi/search.pl', OFF_BASE);
  url.searchParams.set('search_terms', normalizeQuery(query));
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('fields', FIELDS_PARAM);
  return url.toString();
}

export function buildProductUrl(barcode: string): string {
  const url = new URL(`/api/v2/product/${barcode}.json`, OFF_BASE);
  url.searchParams.set('fields', FIELDS_PARAM);
  return url.toString();
}

/** Página pedida, saneada. Fuera de rango se recorta en lugar de fallar. */
export function parsePage(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '1', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_PAGE);
}

export interface UpstreamResult {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Llamada a Open Food Facts con identificación y tiempo máximo.
 *
 * El tiempo máximo importa: sin él, una respuesta lenta dejaría la función
 * colgada hasta que la plataforma la corte, gastando tiempo de ejecución y
 * dejando a quien busca sin respuesta ni error.
 */
export async function fetchUpstream(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UpstreamResult> {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    return { status: response.status, body: null };
  }

  return { status: response.status, body: await response.json() };
}
