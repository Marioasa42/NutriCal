import { normalizeForSearch } from '@contracts/text';

/**
 * Lo que el navegador decide por su cuenta sobre el texto de búsqueda.
 *
 * La normalización ya no vive aquí: es un contrato entre el navegador y la
 * función serverless, y se importa de `@contracts/text` (D-031 y D-033). Lo que
 * queda en este archivo es una decisión del cliente y solo del cliente: a partir
 * de cuánto texto merece la pena salir a la red.
 */

/** Longitud mínima de una búsqueda por texto, antes de salir a la red. */
export const MIN_SEARCH_LENGTH = 3;

/**
 * Una consulta merece una petición solo si tiene suficiente texto útil.
 *
 * No es el mismo número que el `MIN_QUERY_LENGTH` del servidor aunque hoy valgan
 * lo mismo, y por eso no se ha subido a `contracts/`: este umbral puede subir sin
 * romper nada, porque pedir menos de lo permitido siempre le vale al servidor. El
 * de allí es el límite que de verdad se aplica.
 */
export const isSearchable = (value: string): boolean =>
  normalizeForSearch(value).length >= MIN_SEARCH_LENGTH;
