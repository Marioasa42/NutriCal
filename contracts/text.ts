/**
 * Normalización del texto de búsqueda, en un único lugar.
 *
 * Segundo habitante de `contracts/`, y llega por la puerta que D-031 dejó
 * abierta: esta función estaba copiada en `api/_lib/text.ts` y en
 * `src/shared/lib/text.ts`, con un test que comparaba las dos para que no se
 * separasen. Ese test era el precio de la duplicación, y aquí se cambia por un
 * archivo.
 *
 * Pasa la prueba de admisión de D-031, que es concreta: si las dos copias se
 * separasen, ¿se rompería el trato entre las dos puntas? Sí. El navegador
 * normaliza el texto para construir la clave de su caché de consultas, y la
 * función serverless lo normaliza para construir la URL saliente, que es a su
 * vez la clave de la caché de la red de distribución. Las dos cachés están
 * pensadas para acertar a la vez ante "Plátano" y "platano" (D-013), y eso solo
 * se sostiene mientras las dos puntas normalicen igual. Con dos copias, el día
 * que una cambiara el navegador pediría una clave y el servidor guardaría otra,
 * y ninguna de las dos mitades fallaría al probarla por separado.
 *
 * Lo que NO entra aquí es el mínimo de caracteres para buscar. Ver la nota al
 * final del archivo.
 *
 * No tiene importaciones, igual que `barcode.ts`. Es lo que le permite ser
 * consumida por dos proyectos de TypeScript con resoluciones de módulos
 * distintas sin arrastrar nada detrás.
 */

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

/*
 * Nota sobre el mínimo de caracteres, que se quedó fuera a propósito.
 *
 * El navegador tiene `MIN_SEARCH_LENGTH` y la función serverless tiene
 * `MIN_QUERY_LENGTH`, y hoy los dos valen tres. Se parecen a un contrato pero no
 * lo son: el del navegador decide cuándo merece la pena salir a la red y podría
 * subir a cuatro sin romper nada, porque pedir menos siempre es aceptable para
 * el servidor. El del servidor es el límite que de verdad se aplica. Son dos
 * reglas con el mismo número, no una regla en dos sitios, y meterlas aquí las
 * ataría en una sola cuando el día que convenga separarlas no habrá manera de
 * saber cuál de las dos se estaba tocando.
 */
