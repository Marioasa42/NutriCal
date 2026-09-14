import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { diaryRepository } from '@/data/repositories/diary';
import { foodRepository } from '@/data/repositories/foods';
import { seeder } from '@/data/seed';
import type { MealEntry } from '@/domain/diary/meal-entry';
import type { Food } from '@/domain/food/food';
import type { FoodId, MealEntryId } from '@/domain/identity/ids';
import type { LocalDate } from '@/domain/time/local-date';

/**
 * Las lecturas y escrituras locales, a través de TanStack Query.
 *
 * Usar la misma herramienta que para la red merece una explicación, porque
 * CLAUDE.md la reserva para "datos del servidor". Lo que hace falta aquí es
 * exactamente lo que hace falta allí: una lectura asíncrona con sus estados, una
 * caché compartida entre pantallas y una forma de decir "esto ha cambiado, vuelve
 * a leerlo" después de escribir. La alternativa era `dexie-react-hooks`, que
 * resuelve lo mismo con una dependencia más y dos modelos mentales distintos en
 * la misma aplicación; la otra era `useEffect` con `useState`, que significa
 * escribir a mano el cargando, el error y la invalidación en cada pantalla. Ver
 * D-036.
 *
 * Las claves empiezan por `db` para que se distingan de un vistazo de las de
 * `off`, que son las que sí salen a la red.
 */
export const dbKeys = {
  food: (id: FoodId) => ['db', 'food', id] as const,
  meal: (id: MealEntryId) => ['db', 'meal', id] as const,
  mealsOn: (date: LocalDate) => ['db', 'meals', date] as const,
  example: ['db', 'example'] as const,
};

/**
 * `networkMode: 'always'` no es un detalle: es lo que hace que la aplicación siga
 * siendo local primero.
 *
 * Por defecto TanStack Query trabaja en modo `online` y, cuando el navegador
 * dice que no hay red, ni siquiera intenta la consulta: la deja en pausa. Para
 * una petición a Open Food Facts eso es lo correcto (D-029). Para una lectura de
 * IndexedDB sería absurdo y además rompería el requisito principal del proyecto:
 * el diario se quedaría en blanco en el metro, con los datos dentro del
 * dispositivo y a un centímetro de la pantalla.
 */
const LOCAL = { networkMode: 'always' } as const;

/** Lo que puede pasar al buscar un alimento en el catálogo local. */
export type CatalogFoodState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing'; readonly foodId: FoodId }
  | { readonly kind: 'failed'; readonly error: unknown }
  | { readonly kind: 'found'; readonly food: Food };

/**
 * Un alimento del catálogo, por identificador.
 *
 * `missing` es una rama de verdad y no un caso raro: a esta pantalla se llega
 * por una dirección, así que el identificador puede venir de un enlace viejo, de
 * un marcador o de otro dispositivo donde ese alimento no está. Igual que una
 * fecha inválida, no es un fallo de programación (D-025).
 */
export function useCatalogFood(foodId: FoodId): CatalogFoodState {
  const { data, isPending, isError, error } = useQuery({
    queryKey: dbKeys.food(foodId),
    queryFn: () => foodRepository.byId(foodId),
    ...LOCAL,
  });

  if (isError) {
    return { kind: 'failed', error };
  }
  if (isPending) {
    return { kind: 'loading' };
  }
  return data === undefined ? { kind: 'missing', foodId } : { kind: 'found', food: data };
}

/**
 * Guardar un registro del diario.
 *
 * Invalida el día al terminar en lugar de escribir en la caché a mano: lo que
 * queda en pantalla es lo que hay en disco, y no una suposición nuestra de lo que
 * debería haber. Con IndexedDB al lado, releer cuesta milisegundos.
 */
export function useSaveMeal() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (entry: MealEntry) => diaryRepository.saveMeal(entry),
    onSuccess: async (_result, entry) => {
      await client.invalidateQueries({ queryKey: dbKeys.mealsOn(entry.date) });
    },
    ...LOCAL,
  });
}

/** Los registros vivos de un día, en el orden en que se escribieron. */
export function useMealsOn(date: LocalDate) {
  return useQuery({
    queryKey: dbKeys.mealsOn(date),
    queryFn: () => diaryRepository.mealsOn(date),
    ...LOCAL,
  });
}

/** Lo que puede pasar al abrir un registro concreto para editarlo. */
export type MealEntryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'failed'; readonly error: unknown }
  | { readonly kind: 'found'; readonly entry: MealEntry };

/**
 * Un registro por identificador.
 *
 * `missing` no es solo el enlace mal copiado: un registro borrado tiene lápida y
 * el repositorio no lo devuelve (D-006, D-014), así que abrir la dirección de
 * algo que se acaba de borrar cae aquí. Es correcto que así sea, y por eso el
 * mensaje habla de las dos posibilidades.
 */
export function useMealEntry(id: MealEntryId): MealEntryState {
  const { data, isPending, isError, error } = useQuery({
    queryKey: dbKeys.meal(id),
    queryFn: () => diaryRepository.mealById(id),
    ...LOCAL,
  });

  if (isError) {
    return { kind: 'failed', error };
  }
  if (isPending) {
    return { kind: 'loading' };
  }
  return data === undefined ? { kind: 'missing' } : { kind: 'found', entry: data };
}

/**
 * Borrar un registro, que es escribir su lápida (D-006).
 *
 * La fila no desaparece: se le pone fecha de borrado y deja de salir en las
 * consultas. Para quien usa la aplicación el efecto es el mismo; la diferencia
 * se cobrará en la fase 4, cuando sincronizar tenga que saber distinguir un
 * registro que nunca llegó a un dispositivo de uno que allí se borró.
 */
export function useRemoveMeal(date: LocalDate) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: MealEntryId) => diaryRepository.removeMeal(id),
    onSuccess: async (_result, id) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: dbKeys.mealsOn(date) }),
        client.invalidateQueries({ queryKey: dbKeys.meal(id) }),
      ]);
    },
    ...LOCAL,
  });
}

/** Si el ejemplo está puesto, para saber qué botón ofrecer. */
export function useExampleDataLoaded() {
  return useQuery({ queryKey: dbKeys.example, queryFn: () => seeder.isLoaded(), ...LOCAL });
}

/**
 * Poner o quitar los datos de ejemplo.
 *
 * Una sola mutación con un interruptor, y no dos, porque las dos hacen lo mismo
 * después: invalidar el día y el estado del ejemplo. Separarlas repetiría esa
 * cola dos veces.
 */
export function useExampleData(date: LocalDate) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (action: 'load' | 'unload') =>
      action === 'load' ? seeder.load(date) : seeder.unload(),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: dbKeys.mealsOn(date) }),
        client.invalidateQueries({ queryKey: dbKeys.example }),
      ]);
    },
    ...LOCAL,
  });
}
