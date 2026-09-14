import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { MEAL_SLOTS, type MealEntry, type MealSlot } from '@/domain/diary/meal-entry';
import { dayTotals, entryTotals } from '@/domain/diary/totals';
import type { LocalDate } from '@/domain/time/local-date';
import { DayTotalsPanel } from '@/features/diary/DayTotalsPanel';
import { useMealsOn, useRemoveMeal } from '@/features/diary/queries';
import { MEAL_SLOT_LABELS } from '@/shared/lib/meal-labels';
import { formatEnergy, formatQuantity } from '@/shared/lib/nutrient-format';

/**
 * Lo que se ha registrado en un día, agrupado por momento.
 *
 * Agrupar por momento y no por orden de escritura es lo que hace que la pantalla
 * se parezca a cómo se come: se busca "qué cené" antes que "qué registré a las
 * ocho y cuarto". Dentro de cada momento sí manda el orden de escritura, que es
 * el que devuelve el repositorio.
 *
 * Los totales del día se calculan aquí a partir de los registros, y no se
 * guardan en ninguna tabla: son una proyección, y guardarlos crearía una segunda
 * verdad que habría que mantener sincronizada con los registros.
 */
export function DayDiary({ date }: { date: LocalDate }) {
  const { data: meals, isPending, isError } = useMealsOn(date);

  if (isPending) {
    return <Panel>Leyendo tu diario…</Panel>;
  }

  if (isError) {
    return (
      <Panel>
        No hemos podido leer el diario de este dispositivo. Si estás en una ventana privada, puede
        que el almacenamiento esté bloqueado.
      </Panel>
    );
  }

  if (meals.length === 0) {
    return <EmptyDay date={date} />;
  }

  // El ejercicio llega en la fase 5, así que hoy la lista va vacía. Se pasa
  // igualmente porque `dayTotals` lo pide, y así el día que exista no hay que
  // tocar esta llamada.
  const totals = dayTotals(meals, []);

  return (
    <div className="flex flex-col gap-6">
      <DayTotalsPanel totals={totals} entryCount={meals.length} />

      {MEAL_SLOTS.map((slot) => {
        const inSlot = meals.filter((entry) => entry.slot === slot);
        return inSlot.length === 0 ? null : (
          <SlotSection key={slot} slot={slot} entries={inSlot} date={date} />
        );
      })}

      <Link
        to={`/dia/${date}/buscar`}
        className="self-start rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Añadir otro alimento
      </Link>
    </div>
  );
}

function SlotSection({
  slot,
  entries,
  date,
}: {
  slot: MealSlot;
  entries: readonly MealEntry[];
  date: LocalDate;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        {MEAL_SLOT_LABELS[slot]}
      </h2>
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} date={date} />
        ))}
      </ul>
    </section>
  );
}

function EntryRow({ entry, date }: { entry: MealEntry; date: LocalDate }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveMeal(date);
  const { macros } = entryTotals(entry);

  // Cualquier cifra de este registro que rellenó una persona convierte el
  // conjunto en una estimación, y hay que decirlo aquí también: la tarjeta no
  // enseña las macros una a una, así que no hay dónde poner la marca por cifra.
  const estimated = entry.food.completion.userFilled.length > 0;

  return (
    <li className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-slate-900">{entry.food.name}</span>
        {entry.food.brand === undefined ? null : (
          <span className="truncate text-sm text-slate-500">{entry.food.brand}</span>
        )}
        <span className="text-sm text-slate-600">
          {formatQuantity(entry.portion.amountInBaseUnit, entry.food.baseUnit)}
          {entry.portion.selection.kind === 'serving' ? ` · ${describeServing(entry)}` : ''}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="font-semibold text-slate-900">{formatEnergy(macros.energy)}</span>
        {estimated ? (
          <span
            title="Alguna cifra de este alimento la rellenaste a mano."
            className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
          >
            estimación
          </span>
        ) : null}

        <div className="flex items-center gap-2 text-sm">
          <Link
            to={`/dia/${date}/registro/${entry.id}`}
            className="font-medium text-emerald-700 underline underline-offset-4"
          >
            Editar
          </Link>

          {/* Borrar en dos pasos, sin diálogo del navegador: no hay forma de
              deshacerlo desde la interfaz, así que preguntar es lo mínimo. */}
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => {
                  remove.mutate(entry.id);
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
      </div>
    </li>
  );
}

/** "media ración de Un vaso", tal y como se eligió al registrar. */
function describeServing(entry: MealEntry): string {
  const { selection } = entry.portion;
  if (selection.kind !== 'serving') {
    return '';
  }
  const serving = entry.food.servings.find((option) => option.id === selection.servingId);
  const label = serving?.label ?? 'ración';
  return `${selection.count} × ${label}`;
}

function EmptyDay({ date }: { date: LocalDate }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-slate-300 p-6 text-center">
      <p className="text-slate-500">Todavía no has registrado nada este día.</p>
      <Link
        to={`/dia/${date}/buscar`}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Buscar un alimento
      </Link>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600"
    >
      {children}
    </p>
  );
}
