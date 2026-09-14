import type { Food } from '@/domain/food/food';
import type { Instant } from '@/domain/time/local-date';

/**
 * Completa un alimento de USDA ya adoptado en el catálogo con el perfil
 * nutricional de su ficha detallada.
 *
 * La identidad manda del alimento del catálogo (`id`, `createdAt`, y el resto
 * de campos de persistencia): es el que ya usan otras pantallas y el que
 * puede llevar cifras completadas a mano (D-002), aunque hoy eso no le pase a
 * un alimento de USDA porque nace siempre con las cuatro macros. El perfil
 * nutricional manda de la ficha: es la única de las dos formas que trae el
 * panel de micronutrientes completo (D-048).
 *
 * `baseUnit` y `servings` no se tocan a propósito, aunque los dos vengan
 * también en `detail`: para USDA son siempre `'g'` y `[]` (ver el comentario
 * de `buildResult` en `normalize.ts`), así que conservar los del alimento del
 * catálogo es exactamente lo mismo que copiar los de la ficha, y así no hace
 * falta reconciliar dos ramas de la unión discriminada de `Food`.
 */
export function mergeUsdaDetailIntoCatalogFood(
  catalogFood: Food,
  detail: Food,
  updatedAt: Instant,
): Food {
  return {
    ...catalogFood,
    name: detail.name,
    ...(detail.brand !== undefined ? { brand: detail.brand } : {}),
    per100: detail.per100,
    updatedAt,
  };
}
