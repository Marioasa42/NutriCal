/**
 * Tipos con marca (branded types).
 *
 * Un tipo con marca es un tipo primitivo al que se le añade una propiedad que
 * solo existe para el compilador. `Grams` y `Kilocalories` son ambos `number`
 * en tiempo de ejecución, pero TypeScript los trata como incompatibles, así que
 * sumar gramos a kilocalorías deja de compilar.
 *
 * `unique symbol` crea un identificador de tipo irrepetible y `declare` le dice
 * a TypeScript que confíe en que existe sin generar código para él. El resultado
 * es una propiedad fantasma: no aparece en el JavaScript final, no ocupa memoria
 * y nadie puede escribirla por accidente.
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Cualquier número marcado. Útil para escribir utilidades genéricas. */
export type BrandedNumber = Brand<number, string>;

/** Cualquier cadena marcada. La usan los identificadores y las fechas locales. */
export type BrandedString = Brand<string, string>;
