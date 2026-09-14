import { db, type NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createMealEntry, type LogMealContext } from '@/domain/diary/log-meal';
import type { MealEntry, MealSlot } from '@/domain/diary/meal-entry';
import type { Food } from '@/domain/food/food';
import type { FoodId, MealEntryId, ServingId } from '@/domain/identity/ids';
import { now, type Instant, type LocalDate } from '@/domain/time/local-date';
import { grams, kilocalories, milliliters } from '@/domain/units/units';

/**
 * Datos de ejemplo, para que una pantalla recién abierta tenga algo dentro.
 *
 * El motivo está en D-016: cada previsualización de Vercel vive en su propio
 * origen, y como IndexedDB está aislada por origen, toda previsualización
 * arranca con la base de datos vacía. Una pantalla en blanco es lo primero que
 * ve quien abre el enlace de un pull request o la demo del portfolio.
 *
 * Dos reglas gobiernan este archivo:
 *
 * 1. **Nada de atajos.** Los datos sembrados son entidades normales del dominio,
 *    construidas con las mismas funciones que usa la aplicación y escritas por
 *    los mismos repositorios. Si el sembrado funciona, la capa de datos funciona;
 *    si escribiera directamente en las tablas, no demostraría nada.
 * 2. **Identificadores fijos.** Es lo que permite retirar el ejemplo después sin
 *    inventar una marca de "esto es de mentira" en el dominio. Retirar es
 *    escribir lápidas sobre unos identificadores conocidos, con el mismo camino
 *    de borrado que cualquier otro registro (D-006).
 *
 * Nunca se siembra solo: hace falta pulsar el botón. Precargar datos falsos al
 * abrir mezclaría lo inventado con lo de la persona usuaria sin que lo pidiera.
 */

/**
 * Los identificadores del ejemplo son fijos, así que aquí se marcan a mano.
 *
 * Es el único sitio del proyecto donde un identificador no sale de su generador,
 * y el motivo es el de arriba: para poder retirar el ejemplo hay que saber
 * cuáles son. Empiezan por `5eed` para reconocerlos de un vistazo en las
 * herramientas del navegador.
 */
const asFoodId = (value: string): FoodId => value as FoodId;
const asServingId = (value: string): ServingId => value as ServingId;
const asMealEntryId = (value: string): MealEntryId => value as MealEntryId;

const SEED_FOOD_IDS = [
  '5eed0000-0000-4000-8000-000000000001',
  '5eed0000-0000-4000-8000-000000000002',
  '5eed0000-0000-4000-8000-000000000003',
  '5eed0000-0000-4000-8000-000000000004',
] as const;

const SEED_MEAL_IDS = [
  '5eed0000-0000-4000-8000-000000000101',
  '5eed0000-0000-4000-8000-000000000102',
  '5eed0000-0000-4000-8000-000000000103',
  '5eed0000-0000-4000-8000-000000000104',
] as const;

/**
 * Los alimentos de ejemplo.
 *
 * Su origen es `custom` y no `openFoodFacts`, a propósito: inventar un código de
 * barras haría que un dato de mentira se presentara como venido de la fuente, y
 * además chocaría con el catálogo real en cuanto alguien buscara ese producto.
 * Las cifras son de tablas de composición al uso, redondeadas.
 *
 * La leche va en mililitros para que el ejemplo enseñe también ese camino: es la
 * mitad del dominio que más fácil se queda sin probar a ojo (D-005).
 */
function seedFoods(at: Instant): readonly Food[] {
  const persisted = { createdAt: at, updatedAt: at, completion: { userFilled: [] } } as const;
  const [bananaId, milkId, chickenId, yogurtId] = SEED_FOOD_IDS;

  return [
    {
      ...persisted,
      id: asFoodId(bananaId),
      name: 'Plátano',
      source: { kind: 'custom' },
      baseUnit: 'g',
      per100: {
        macros: {
          energy: kilocalories(89),
          protein: grams(1.1),
          carbohydrates: grams(22.8),
          fat: grams(0.3),
          sugars: grams(12.2),
          fiber: grams(2.6),
        },
        micros: {},
      },
      servings: [
        {
          id: asServingId('5eed0000-0000-4000-8000-000000000201'),
          label: 'Uno mediano',
          amountInBaseUnit: grams(120),
        },
      ],
    },
    {
      ...persisted,
      id: asFoodId(milkId),
      name: 'Leche semidesnatada',
      source: { kind: 'custom' },
      baseUnit: 'ml',
      per100: {
        macros: {
          energy: kilocalories(46),
          protein: grams(3.1),
          carbohydrates: grams(4.8),
          fat: grams(1.6),
          sugars: grams(4.8),
        },
        micros: {},
      },
      servings: [
        {
          id: asServingId('5eed0000-0000-4000-8000-000000000202'),
          label: 'Un vaso',
          amountInBaseUnit: milliliters(200),
        },
      ],
    },
    {
      ...persisted,
      id: asFoodId(chickenId),
      name: 'Pechuga de pollo a la plancha',
      source: { kind: 'custom' },
      baseUnit: 'g',
      // Sin azúcares ni fibra a propósito: así los totales del día llevan un
      // `unknown` mayor que cero y se ve en pantalla la marca que exige D-026.
      per100: {
        macros: {
          energy: kilocalories(165),
          protein: grams(31),
          carbohydrates: grams(0),
          fat: grams(3.6),
        },
        micros: {},
      },
      servings: [
        {
          id: asServingId('5eed0000-0000-4000-8000-000000000203'),
          label: 'Un filete',
          amountInBaseUnit: grams(150),
        },
      ],
    },
    {
      ...persisted,
      id: asFoodId(yogurtId),
      name: 'Yogur natural',
      source: { kind: 'custom' },
      baseUnit: 'g',
      per100: {
        macros: {
          energy: kilocalories(61),
          protein: grams(3.5),
          carbohydrates: grams(4.7),
          fat: grams(3.3),
          sugars: grams(4.7),
        },
        micros: {},
      },
      servings: [
        {
          id: asServingId('5eed0000-0000-4000-8000-000000000204'),
          label: 'Una unidad',
          amountInBaseUnit: grams(125),
        },
      ],
    },
  ];
}

/**
 * Un día cualquiera, con sus momentos repartidos.
 *
 * `food` es la posición dentro del catálogo de arriba, y `satisfies` comprueba
 * que la forma es la esperada sin perder los literales, así que `slot` sigue
 * siendo el momento concreto y no un `string`.
 */
const SEED_MEALS = [
  { food: 1, slot: 'breakfast', amount: 200 },
  { food: 0, slot: 'breakfast', amount: 120 },
  { food: 2, slot: 'lunch', amount: 150 },
  { food: 3, slot: 'snack', amount: 125 },
] as const satisfies readonly { food: number; slot: MealSlot; amount: number }[];

export function createSeeder(database: NutriCalDatabase) {
  const foods = createFoodRepository(database);
  const diary = createDiaryRepository(database);

  return {
    /**
     * Escribe el ejemplo en el día que se está mirando.
     *
     * En el día que se mira, y no en hoy, porque el botón vive en esa pantalla:
     * pulsar "cargar ejemplo" y que el contenido aparezca en otra fecha sería
     * justo lo contrario de lo que se esperaba. Sembrar dos veces no duplica
     * nada, porque los identificadores son fijos: el segundo sembrado reescribe
     * el primero, y si estaba retirado lo devuelve a la vida.
     */
    async load(date: LocalDate, clock: () => Instant = now): Promise<void> {
      const at = clock();
      const catalog = seedFoods(at);
      await foods.saveMany(catalog);

      const entries: MealEntry[] = [];
      SEED_MEALS.forEach((meal, index) => {
        const food = catalog[meal.food];
        const id = SEED_MEAL_IDS[index];
        if (food === undefined || id === undefined) {
          return;
        }

        // La misma función que usa el formulario, con un contexto de
        // identificadores fijos. El sembrado no tiene un camino propio.
        const context: LogMealContext = { now: clock, newMealEntryId: () => asMealEntryId(id) };
        const created = createMealEntry(
          { food, date, slot: meal.slot, choice: { kind: 'baseUnit', amount: meal.amount } },
          context,
        );
        if (created.kind === 'created') {
          entries.push(created.entry);
        }
      });

      await diary.saveMeals(entries);
    },

    /**
     * Retira el ejemplo escribiendo lápidas, nunca borrando filas (D-006).
     *
     * Es deliberado que sea el mismo borrado que el de cualquier registro: si el
     * ejemplo se fuera por una puerta especial, no probaría el camino que de
     * verdad se usa, y encima dejaría la sincronización de la fase 4 sin saber
     * que esas filas se habían ido.
     */
    async unload(at: Instant = now()): Promise<void> {
      for (const id of SEED_MEAL_IDS) {
        await diary.removeMeal(asMealEntryId(id), at);
      }
      for (const id of SEED_FOOD_IDS) {
        await foods.remove(asFoodId(id), at);
      }
    },

    /** Si queda algún registro de ejemplo vivo, para saber qué botón ofrecer. */
    async isLoaded(): Promise<boolean> {
      const found = await Promise.all(SEED_MEAL_IDS.map((id) => diary.mealById(asMealEntryId(id))));
      return found.some((entry) => entry !== undefined);
    },
  };
}

export const seeder = createSeeder(db);
