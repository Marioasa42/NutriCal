import { z } from 'zod';

/**
 * Validación de la frontera con la red.
 *
 * La idea que sostiene este archivo es que aquí conviven DOS contratos distintos
 * y merecen rigor distinto:
 *
 * 1. La envoltura la escribimos nosotros en `api/_lib/handlers.ts`. Si no cuadra,
 *    el error es nuestro y tiene que fallar ruidosamente. Se valida estricta.
 * 2. El producto de dentro lo escribe Open Food Facts, que es inconsistente por
 *    naturaleza. Se valida permisivo: campos tolerantes y objeto abierto. Si
 *    fuera estricto, un solo producto raro tumbaría la búsqueda entera.
 *
 * Regla que no se rompe en ningún esquema de este archivo: ni `.default()`, ni
 * `.catch()`, ni coerción. Un `.default(0)` es exactamente la puerta por la que
 * un dato que la fuente no aporta se convertiría en un cero falso, que es lo que
 * la decisión D-001 prohíbe.
 */

/** Los códigos de error que producen nuestras propias funciones serverless. */
export const API_ERROR_CODES = [
  'invalid_request',
  'not_found',
  'rate_limited',
  'upstream_error',
  'upstream_timeout',
] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});

/**
 * Respuesta de `/api/off/search`.
 *
 * `products` es `unknown[]` a propósito. La envoltura garantiza que hay una
 * lista; qué contiene cada elemento es problema del esquema del producto, y se
 * decide elemento a elemento para que uno malo no arrastre a los demás.
 */
export const searchPayloadSchema = z.object({
  query: z.string(),
  page: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  products: z.array(z.unknown()),
});

export type SearchPayload = z.infer<typeof searchPayloadSchema>;

/** Respuesta de `/api/off/product/[barcode]`. `product` es `null` si no existe. */
export const productPayloadSchema = z.object({
  barcode: z.string(),
  product: z.unknown(),
});

export type ProductPayload = z.infer<typeof productPayloadSchema>;

/**
 * El diccionario de nutrientes tal y como llega.
 *
 * El valor es `unknown` porque Open Food Facts mezcla números, cadenas, cadenas
 * vacías y nulos en el mismo campo según el producto. Interpretar cada valor es
 * trabajo de `readNutrient`, que distingue los tres casos que importan; aquí
 * solo comprobamos que sea un diccionario.
 */
export const offNutrimentsSchema = z.record(z.string(), z.unknown());

export type OffNutriments = z.infer<typeof offNutrimentsSchema>;

/**
 * Un producto de Open Food Facts.
 *
 * `z.looseObject` conserva las claves que no declaramos en lugar de tirarlas: la
 * fuente añade campos cada pocos meses y no queremos que eso rompa nada.
 *
 * `.nullish()` acepta el valor, `null` y la clave ausente. No es dejadez: OFF
 * envía `null` en campos de texto con normalidad, y si el esquema solo aceptara
 * cadenas, un producto con `serving_quantity: null` (los hay, el aceite del
 * fixture es uno) dejaría de poder leerse por un campo que ni siquiera es
 * obligatorio para nosotros.
 */
export const offProductSchema = z.looseObject({
  code: z.string().nullish(),
  product_name: z.string().nullish(),
  product_name_es: z.string().nullish(),
  brands: z.string().nullish(),
  quantity: z.string().nullish(),
  serving_size: z.string().nullish(),
  /*
   * `.optional()` no sobra: en Zod un `z.unknown()` pelado es una clave
   * OBLIGATORIA que además admite cualquier valor. Sin esto, un producto sin
   * `serving_quantity`, que son legión en la fuente, fallaba la validación
   * entera y se descartaba como ilegible por culpa de un campo que ni siquiera
   * necesitamos.
   */
  serving_quantity: z.unknown().optional(),
  nutrition_data_per: z.string().nullish(),
  image_front_small_url: z.string().nullish(),
  nutriments: offNutrimentsSchema.nullish(),
});

export type OffProduct = z.infer<typeof offProductSchema>;
