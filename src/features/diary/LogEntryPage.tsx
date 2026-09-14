import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { createMealEntry, type PortionChoice } from '@/domain/diary/log-meal';
import type { MealSlot } from '@/domain/diary/meal-entry';
import type { Food } from '@/domain/food/food';
import type { FoodId } from '@/domain/identity/ids';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { EntryForm } from '@/features/diary/EntryForm';
import { useCatalogFood } from '@/features/diary/queries';
import { formatLocalDate } from '@/shared/lib/format-date';
import { formatEnergy } from '@/shared/lib/nutrient-format';

/**
 * Registrar un alimento del catálogo en un día.
 *
 * La dirección es `/dia/:date/registrar/:foodId`, y que el alimento viaje por la
 * URL como identificador es la misma decisión que D-032 tomó para el código de
 * barras: quien produce el alimento (la búsqueda, el código tecleado, mañana la
 * cámara) no tiene que saber qué pasa después, solo tiene que producir un
 * identificador. De regalo, esta pantalla se puede recargar sin perder nada y el
 * botón de atrás vuelve a los resultados.
 *
 * Que el identificador exista en disco lo garantiza la búsqueda, que guarda en
 * el catálogo local todo lo que consulta (D-013). Aun así, `missing` es una rama
 * de verdad: un enlace viejo o copiado de otro dispositivo puede traer un
 * identificador que aquí no está.
 */
export function LogEntryPage() {
  const { date: rawDate = '', foodId = '' } = useParams<{ date: string; foodId: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <LogEntry date={date} foodId={foodId as FoodId} />;
}

function LogEntry({ date, foodId }: { date: LocalDate; foodId: FoodId }) {
  const state = useCatalogFood(foodId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}/buscar`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver a buscar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Añadir al diario</h1>
        <p className="text-sm text-slate-500">Para el {formatLocalDate(date)}</p>
      </div>

      {renderState()}
    </div>
  );

  function renderState() {
    switch (state.kind) {
      case 'loading':
        return <Note>Buscando el alimento en tu dispositivo…</Note>;
      case 'missing':
        return <Missing date={date} />;
      case 'failed':
        return (
          <Note>
            No hemos podido leer el catálogo de este dispositivo. Si estás en una ventana privada,
            puede que el almacenamiento esté bloqueado.
          </Note>
        );
      case 'found':
        return <Ready date={date} food={state.food} />;
    }
  }
}

function Ready({ date, food }: { date: LocalDate; food: Food }) {
  const navigate = useNavigate();

  return (
    <>
      <FoodHeader food={food} />
      <EntryForm
        food={food}
        submitLabel="Añadir al diario"
        // Quien construye el registro es el dominio, y la pantalla solo le pasa
        // lo que se ha elegido. La misma función sirve para la vista previa y
        // para lo que se guarda.
        build={(slot: MealSlot, choice: PortionChoice) =>
          createMealEntry({ food, date, slot, choice })
        }
        onSaved={() => {
          // `replace`: una vez guardado, volver atrás debe llevar a la búsqueda,
          // no a este formulario ya usado, que invitaría a registrar dos veces
          // lo mismo sin querer.
          void navigate(`/dia/${date}`, { replace: true });
        }}
      />
    </>
  );
}

/** La ficha del alimento, para saber qué se está registrando. */
function FoodHeader({ food }: { food: Food }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{food.name}</span>
        {food.brand === undefined ? null : (
          <span className="text-sm text-slate-500">{food.brand}</span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-semibold text-slate-900">
          {formatEnergy(food.per100.macros.energy)}
        </span>
        <span className="text-xs text-slate-500">por 100 {food.baseUnit}</span>
      </div>
    </div>
  );
}

function Missing({ date }: { date: LocalDate }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 p-6">
      <p className="font-medium text-slate-900">Ese alimento no está en tu catálogo</p>
      <p className="text-slate-600">
        Puede que el enlace sea de otro dispositivo o de antes de borrarlo. Búscalo otra vez y
        vuelve a añadirlo.
      </p>
      <Link
        to={`/dia/${date}/buscar`}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Buscar un alimento
      </Link>
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600"
    >
      {children}
    </p>
  );
}
