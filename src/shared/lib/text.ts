/**
 * Normaliza un texto para compararlo o para usarlo como clave de caché.
 *
 * Recorta, pasa a minúsculas, colapsa los espacios repetidos y quita los signos
 * diacríticos. Lo último importa en español: sin ello, buscar "platano" no
 * encontraría "plátano", y "Leche" y "leche" pedirían dos entradas distintas a
 * la caché de la función serverless.
 *
 * `normalize('NFD')` separa cada letra acentuada en letra y acento, y la
 * expresión regular con la propiedad Unicode `Diacritic` borra los acentos.
 *
 * Esto reduce también la eñe a ene, porque Unicode la descompone igual. Es
 * intencionado: quien teclee "pina colada" en un teclado sin eñe debe
 * encontrarla. Solo afecta a la comparación, nunca al texto que se muestra.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Longitud mínima de una búsqueda por texto, antes de salir a la red. */
export const MIN_SEARCH_LENGTH = 3;

/** Una consulta merece una petición solo si tiene suficiente texto útil. */
export const isSearchable = (value: string): boolean =>
  normalizeForSearch(value).length >= MIN_SEARCH_LENGTH;
