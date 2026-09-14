import type { MealSlot } from '@/domain/diary/meal-entry';

/**
 * El nombre de cada momento del día, en español.
 *
 * Vive en `shared/lib` por el mismo motivo que `MACRO_LABELS`: el dominio no
 * sabe en qué idioma se lee. `satisfies` obliga a que estén los cuatro y ninguno
 * de más, así que añadir un momento nuevo a `MealSlot` deja de compilar hasta
 * que tenga nombre.
 *
 * "Comida" y "Cena" en lugar de "Almuerzo" y "Merienda" porque es como se dice
 * en España, que es donde se usa la aplicación. Si algún día hay más idiomas,
 * esto es lo que se traduce, y el dominio no se entera.
 */
export const MEAL_SLOT_LABELS = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Tentempié',
} as const satisfies Record<MealSlot, string>;
