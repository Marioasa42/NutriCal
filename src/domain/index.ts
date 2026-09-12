/**
 * Punto de entrada del dominio.
 *
 * Todo lo que hay debajo de `domain/` es código puro: no importa React, ni la
 * red, ni Dexie. Eso permite probarlo con Vitest sin montar nada y hace que las
 * reglas de negocio sobrevivan intactas a cualquier cambio de interfaz o de
 * almacenamiento.
 */
export * from '@/domain/brand';
export * from '@/domain/diary/day';
export * from '@/domain/diary/exercise-entry';
export * from '@/domain/diary/meal-entry';
export * from '@/domain/food/draft';
export * from '@/domain/food/food';
export * from '@/domain/goals/goals';
export * from '@/domain/identity/ids';
export * from '@/domain/nutrition/macros';
export * from '@/domain/nutrition/micronutrients';
export * from '@/domain/persistence/persisted';
export * from '@/domain/profile/profile';
export * from '@/domain/time/local-date';
export * from '@/domain/transfer/export';
export * from '@/domain/units/units';
