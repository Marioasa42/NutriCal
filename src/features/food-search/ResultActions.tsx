import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import type { LocalDate } from '@/domain/time/local-date';
import { useRemoveCustomFood } from '@/features/food-search/custom-food-queries';
import { useCompleteUsdaFood } from '@/features/food-search/useCompleteUsdaFood';

/**
 * Qué se puede hacer con un resultado.
 *
 * Para OFF, la acción es un enlace, y eso no es casualidad ni pereza: el
 * alimento ya está guardado en el catálogo local cuando la tarjeta se dibuja
 * (D-013), así que para registrarlo basta con ir a una dirección que lleve su
 * identificador. Con un botón que primero escribiera y luego navegara, esta
 * funcionalidad tendría que importar código de la del diario, y la dirección
 * de las dependencias de D-027 dice que eso no puede ser.
 *
 * Para USDA, `AddUsdaFoodLink` rompe ese patrón a propósito: un resultado de
 * USDA nace sin micronutrientes (D-048), así que "añadir" no puede ser
 * navegar sin más, tiene que completar primero. Eso sigue sin tocar `diary/`:
 * `useCompleteUsdaFood` solo conoce el repositorio de alimentos y el
 * servicio de USDA, ninguno de los dos es de la funcionalidad del diario, así
 * que D-027 se sostiene igual.
 */

/** Llevar un alimento completo al formulario de registro. */
export function AddToDiaryLink({ date, food }: { date: LocalDate; food: Food }) {
  return (
    <Link
      to={`/dia/${date}/registrar/${food.id}`}
      className="inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
    >
      Añadir al diario
    </Link>
  );
}

/**
 * Llevar un borrador a la pantalla donde se completa.
 *
 * Esa pantalla es la del código de barras, que ya sabe resolver el producto y
 * ahora también sabe pedir lo que falta. Se navega con el código y no con el
 * borrador entero por lo mismo de siempre: una dirección se puede recargar y
 * compartir, y el borrador que hay en memoria no.
 *
 * Un borrador sin código de barras no puede llevar a ninguna parte. Hoy no
 * existe, porque la normalización descarta los productos que no traen código
 * (`unreadable`), pero el tipo lo permite y un hueco mudo parecería un fallo de
 * la aplicación, así que se dice.
 */
export function CompleteDraftLink({ date, draft }: { date: LocalDate; draft: FoodDraft }) {
  if (draft.source.kind !== 'openFoodFacts') {
    return (
      <p className="text-sm text-slate-500">
        Este resultado no trae código de barras, así que todavía no se puede completar.
      </p>
    );
  }

  return (
    <Link
      to={`/dia/${date}/codigo/${draft.source.barcode}`}
      className="inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
    >
      Completar y añadir
    </Link>
  );
}

/**
 * Añadir un alimento de USDA al diario: completa su panel de micronutrientes
 * antes de navegar, en vez de navegar directamente (D-048).
 *
 * `useCompleteUsdaFood` ya sabe no volver a pedir la ficha si el alimento
 * llega con micronutrientes (una visita anterior ya lo completó), así que
 * este botón también sirve, sin cambios, para un alimento de USDA que
 * aparece en "En tu catálogo" mientras se teclea.
 */
export function AddUsdaFoodLink({ date, food }: { date: LocalDate; food: Food }) {
  const navigate = useNavigate();
  const complete = useCompleteUsdaFood();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          complete.mutate(food, {
            onSuccess: (result) => {
              if (result.kind === 'completed') {
                void navigate(`/dia/${date}/registrar/${result.food.id}`);
              }
            },
          });
        }}
        disabled={complete.isPending}
        className="inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
      >
        {complete.isPending ? 'Completando…' : 'Añadir al diario'}
      </button>
      {complete.isError || complete.data?.kind === 'unavailable' ? (
        <span className="text-xs text-red-700">No se ha podido completar. Prueba otra vez.</span>
      ) : null}
    </div>
  );
}

/**
 * La acción que corresponde según de dónde salió el alimento.
 *
 * Vive aquí, y no repetida en cada pantalla que enseña una tarjeta, porque
 * `SearchResults.tsx` la necesita tanto para los resultados recién traídos
 * como para "en tu catálogo", y las dos listas pueden mezclar alimentos de
 * las dos fuentes.
 */
export function FoodAction({ date, food }: { date: LocalDate; food: Food }) {
  switch (food.source.kind) {
    case 'usda':
      return <AddUsdaFoodLink date={date} food={food} />;
    case 'openFoodFacts':
    case 'custom':
      return <AddToDiaryLink date={date} food={food} />;
  }
}

/**
 * Editar o borrar un alimento propio, desde la tarjeta del catálogo.
 *
 * Solo tiene sentido para `source.kind === 'custom'` (D-032 en su versión de
 * fase 1: un alimento de Open Food Facts o de USDA no se edita aquí, eso
 * sería reescribir el dato de la fuente, una funcionalidad distinta a la que
 * pide esta tarea). Quien llama decide cuándo montarlo.
 *
 * Confirmación en dos pasos y borrado con lápida + deshacer, calcado del
 * patrón de `DayDiary.tsx` (D-042): la confirmación protege del toque mal
 * dado, el deshacer del arrepentimiento inmediato, y no son lo mismo aunque
 * lo parezcan. `onDeleted` avisa al padre porque la fila desaparece de la
 * lista en cuanto se invalida la consulta, y con ella su propio estado: el
 * hueco con el deshacer tiene que vivir en quien sobrevive al borrado.
 */
export function CustomFoodManageLinks({
  date,
  food,
  onDeleted,
}: {
  date: LocalDate;
  food: Food;
  onDeleted: (food: Food) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveCustomFood();

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        to={`/dia/${date}/alimento/${food.id}/editar`}
        className="font-medium text-emerald-700 underline underline-offset-4"
      >
        Editar
      </Link>

      {confirming ? (
        <>
          <button
            type="button"
            onClick={() => {
              remove.mutate(food.id, {
                onSuccess: () => {
                  onDeleted(food);
                },
              });
            }}
            disabled={remove.isPending}
            className="font-medium text-red-700 underline underline-offset-4 disabled:text-slate-400"
          >
            Sí, borrar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
            }}
            className="text-slate-500 underline underline-offset-4"
          >
            No
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className="text-slate-500 underline underline-offset-4 hover:text-red-700"
        >
          Borrar
        </button>
      )}
    </div>
  );
}
