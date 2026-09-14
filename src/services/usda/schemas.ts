import { z } from 'zod';

import { API_ERROR_CODES, apiErrorSchema } from '@/services/shared/api-error';

/**
 * Validación de la frontera con la red, para USDA FoodData Central.
 *
 * Mismo reparto de rigor que `services/off/schemas.ts` (D-019): la envoltura
 * la escribimos nosotros en `api/_lib/usda-handlers.ts` y se valida estricta;
 * el alimento de dentro lo escribe FDC y se valida permisivo.
 *
 * La diferencia con OFF, y el motivo de que este archivo no sea un calco
 * exacto, es que FDC no habla un único formato de producto: la respuesta de
 * `/foods/search` y la respuesta de `/food/{fdcId}?format=abridged` traen el
 * mismo dato (qué nutriente, cuánto hay) con nombres de campo distintos
 * (`nutrientNumber`/`value` frente a `number`/`amount`). No es una elección
 * nuestra, es cómo responde la API real (D-047, "Consecuencias"), así que hay
 * dos esquemas de nutriente en vez de uno.
 */

export { API_ERROR_CODES, apiErrorSchema };

/** Respuesta de `/api/usda/search`. `foods` es `unknown[]`: cada fila se valida por separado. */
export const usdaSearchPayloadSchema = z.object({
  query: z.string(),
  foods: z.array(z.unknown()),
});

export type UsdaSearchPayload = z.infer<typeof usdaSearchPayloadSchema>;

/** Respuesta de `/api/usda/food/[fdcId]`. `food` es `null` si FDC no conoce ese identificador. */
export const usdaFoodPayloadSchema = z.object({
  fdcId: z.number().int().positive(),
  food: z.unknown(),
});

export type UsdaFoodPayload = z.infer<typeof usdaFoodPayloadSchema>;

/**
 * Un nutriente dentro de un resultado de búsqueda.
 *
 * `nutrientNumber` admite cadena o número porque no hay garantía documentada
 * de cuál manda FDC en cada caso; `findInSearchNutrients` lo compara siempre
 * como texto, así que aquí basta con no rechazar ninguna de las dos formas.
 */
export const usdaSearchNutrientSchema = z.looseObject({
  nutrientNumber: z.union([z.string(), z.number()]).nullish(),
  nutrientName: z.string().nullish(),
  unitName: z.string().nullish(),
  value: z.number().nullish(),
});

export type UsdaSearchNutrient = z.infer<typeof usdaSearchNutrientSchema>;

/**
 * Un alimento dentro de una página de resultados de búsqueda.
 *
 * `z.looseObject` conserva los campos que no declaramos, igual que
 * `offProductSchema`: FDC amplía su respuesta de vez en cuando y un campo
 * nuevo no debe tumbar la validación de los que sí usamos.
 */
export const usdaSearchFoodSchema = z.looseObject({
  fdcId: z.number().int().positive(),
  description: z.string().nullish(),
  brandOwner: z.string().nullish(),
  brandName: z.string().nullish(),
  dataType: z.string().nullish(),
  foodNutrients: z.array(usdaSearchNutrientSchema).nullish(),
});

export type UsdaSearchFood = z.infer<typeof usdaSearchFoodSchema>;

/** Un nutriente dentro de una ficha pedida con `format=abridged`. */
export const usdaFoodNutrientSchema = z.looseObject({
  number: z.union([z.string(), z.number()]).nullish(),
  name: z.string().nullish(),
  amount: z.number().nullish(),
  unitName: z.string().nullish(),
});

export type UsdaFoodNutrient = z.infer<typeof usdaFoodNutrientSchema>;

/** La ficha completa de un alimento, pedida con `format=abridged`. */
export const usdaFoodDetailSchema = z.looseObject({
  fdcId: z.number().int().positive(),
  description: z.string().nullish(),
  brandOwner: z.string().nullish(),
  brandName: z.string().nullish(),
  dataType: z.string().nullish(),
  foodNutrients: z.array(usdaFoodNutrientSchema).nullish(),
});

export type UsdaFoodDetail = z.infer<typeof usdaFoodDetailSchema>;
