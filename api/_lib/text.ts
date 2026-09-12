/**
 * Normalización de texto para la clave de caché.
 *
 * Está duplicada a propósito respecto a `src/shared/lib/text.ts`. La función
 * serverless es un desplegable aparte, con su propio proyecto de TypeScript y su
 * propio entorno de ejecución, y no debe depender del código del navegador. Son
 * diez líneas: el coste de la duplicación es menor que el de acoplar los dos
 * mundos.
 *
 * Para que no se separen con el tiempo, hay un test que compara ambas
 * implementaciones con el mismo conjunto de entradas.
 */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
