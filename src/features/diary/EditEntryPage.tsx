import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { choiceOf, reviseMealEntry, type PortionChoice } from '@/domain/diary/log-meal';
import type { MealEntry, MealSlot } from '@/domain/diary/meal-entry';
import type { MealEntryId } from '@/domain/identity/ids';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { EntryForm } from '@/features/diary/EntryForm';
import { useMealEntry } from '@/features/diary/queries';
import { formatLocalDate } from '@/shared/lib/format-date';
import { formatEnergy } from '@/shared/lib/nutrient-format';

/**
 * Editar un registro que ya existe.
 *
 * **No se vuelve a consultar la fuente.** Lo que se edita es la porción y el
 * momento; las cifras nutricionales salen de la instantánea que se copió al
 * registrar, y por eso corregir "150 g" por "160 g" no puede cambiar de paso las
 * calorías porque Open Food Facts haya tocado su ficha (D-003). Esa es también
 * la razón de que esta pantalla no necesite el catálogo para nada: el alimento
 * de origen podría estar borrado y el registro seguiría siendo editable.
 *
 * Reutiliza el formulario del paso 5 entero. Lo único distinto es la función que
 * construye el registro: allí `createMealEntry`, aquí `reviseMealEntry`.
 */
export function EditEntryPage() {
  const { date: rawDate = '', entryId = '' } = useParams<{ date: string; entryId: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <Edit date={date} entryId={entryId as MealEntryId} />;
}

function Edit({ date, entryId }: { date: LocalDate; entryId: MealEntryId }) {
  const state = useMealEntry(entryId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver al día
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar el registro</h1>
        <p className="text-sm text-slate-500">Del {formatLocalDate(date)}</p>
      </div>

      {renderState()}
    </div>
  );

  function renderState() {
    switch (state.kind) {
      case 'loading':
        return <Note>Buscando el registro…</Note>;
      case 'missing':
        return <Missing date={date} />;
      case 'failed':
        return <Note>No hemos podido leer el diario de este dispositivo.</Note>;
      case 'found':
        return <Ready date={date} entry={state.entry} />;
    }
  }
}

function Ready({ date, entry }: { date: LocalDate; entry: MealEntry }) {
  const navigate = useNavigate();

  return (
    <>
      <EntrySummary entry={entry} />
      <EntryForm
        food={entry.food}
        initialSlot={entry.slot}
        // La elección tal y como se hizo, no su equivalencia en gramos: quien
        // registró "media ración" tiene que volver a ver "media ración".
        initialChoice={choiceOf(entry)}
        submitLabel="Guardar los cambios"
        build={(slot: MealSlot, choice: PortionChoice) => reviseMealEntry(entry, { slot, choice })}
        onSaved={() => {
          void navigate(`/dia/${date}`, { replace: true });
        }}
      />
    </>
  );
}

/** Qué se está editando. Las cifras son las de la instantánea, no las de hoy. */
function EntrySummary({ entry }: { entry: MealEntry }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{entry.food.name}</span>
        {entry.food.brand === undefined ? null : (
          <span className="text-sm text-slate-500">{entry.food.brand}</span>
        )}
        <span className="text-xs text-slate-500">
          Cifras guardadas al registrarlo, no se vuelven a consultar.
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-semibold text-slate-900">
          {formatEnergy(entry.food.per100.macros.energy)}
        </span>
        <span className="text-xs text-slate-500">por 100 {entry.food.baseUnit}</span>
      </div>
    </div>
  );
}

function Missing({ date }: { date: LocalDate }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 p-6">
      <p className="font-medium text-slate-900">Ese registro ya no está</p>
      <p className="text-slate-600">
        Puede que lo hayas borrado o que el enlace sea de otro dispositivo.
      </p>
      <Link
        to={`/dia/${date}`}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Volver al día
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
