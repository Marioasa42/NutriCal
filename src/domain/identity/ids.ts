import type { Brand } from '@/domain/brand';

/**
 * Identificadores del dominio.
 *
 * Van marcados por el mismo motivo que las unidades: todos son cadenas, pero
 * pasar el identificador de un alimento donde se espera el de un registro deja
 * de compilar.
 *
 * Se generan siempre en el cliente con UUID v4, nunca con autoincremento. Un
 * contador obliga a que exista un servidor que reparta números, y la aplicación
 * tiene que funcionar entera sin backend. Además, cuando llegue la sincronización
 * entre dispositivos, dos móviles sin conexión pueden crear registros a la vez
 * sin chocar.
 */
export type FoodId = Brand<string, 'FoodId'>;
export type ServingId = Brand<string, 'ServingId'>;
export type MealEntryId = Brand<string, 'MealEntryId'>;
export type ExerciseEntryId = Brand<string, 'ExerciseEntryId'>;
export type GoalsId = Brand<string, 'GoalsId'>;
export type ProfileId = Brand<string, 'ProfileId'>;

/** Cualquier identificador del dominio. */
export type EntityId = FoodId | ServingId | MealEntryId | ExerciseEntryId | GoalsId | ProfileId;

/**
 * Generadores de identificadores. Hay uno por entidad en lugar de un genérico
 * `newId<FoodId>()`, porque un genérico que solo aparece en el tipo de retorno
 * es una aserción de tipo disfrazada: quien llama elige el tipo y nada lo
 * comprueba. Con funciones con nombre, el tipo lo decide esta capa.
 */
const uuid = (): string => crypto.randomUUID();

export const newFoodId = (): FoodId => uuid() as FoodId;
export const newServingId = (): ServingId => uuid() as ServingId;
export const newMealEntryId = (): MealEntryId => uuid() as MealEntryId;
export const newExerciseEntryId = (): ExerciseEntryId => uuid() as ExerciseEntryId;
export const newGoalsId = (): GoalsId => uuid() as GoalsId;
export const newProfileId = (): ProfileId => uuid() as ProfileId;
