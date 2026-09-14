import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { MEAL_SLOTS, type MealEntry, type MealSlot } from '@/domain/diary/meal-entry';
import { dayTotals, entryTotals } from '@/domain/diary/totals';
import type { MealEntryId } from '@/domain/identity/ids';
import type { LocalDate } from '@/domain/time/local-date';
import { DayTotalsPanel } from '@/features/diary/DayTotalsPanel';
import { useMealsOn, useRemoveMeal, useRestoreMeal } from '@/features/diary/queries';
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
 *
 * ## Por qué el borrado se recuerda aquí y no en la fila (D-042)
 *
 * Lo natural sería guardar "esto se acaba de borrar" dentro de `EntryRow`, junto
 * al estado de la confirmación. No funciona: en cuanto se borra, el registro
 * desaparece de `useMealsOn`, React desmonta esa fila y se lleva su estado por
 * delante, así que no quedaría nadie para ofrecer el deshacer. El hueco tiene
 * que recordarlo quien sobrevive al borrado, que es esta pantalla.
 *
 * Y como vive aquí, dura lo que dura la pantalla: irse del día o recargar se
 * lleva el deshacer. Eso es deliberado y es lo que permite no tener temporizador
 * ni componente de avisos flotantes, que es lo que D-038 descartó por coste.
 */
export function DayDiary({ date }: { date: LocalDate }) {
  const { data: meals, isPending, isError } = useMealsOn(date);

  /** Registros borrados en esta visita que todavía se pueden recuperar. */
  const [undoable, setUndoable] = useState<readonly MealEntry[]>([]);

  const noteDeleted = (entry: MealEntry) => {
    setUndoable((previous) => [...previous, entry]);
  };
  const forget = (id: MealEntryId) => {
    setUndoable((previous) => previous.filter((entry) => entry.id !== id));
  };

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

  // El día vacío solo si además no hay nada que deshacer: si acabas de borrar tu
  // único registro, lo que tiene que verse es el hueco con su "Deshacer", no una
  // pantalla que se comporta como si ahí nunca hubiera habido nada.
  if (meals.length === 0 && undoable.length === 0) {
    return <EmptyDay date={date} />;
  }

  // El ejercicio llega en la fase 5, así que hoy la lista va vacía. Se pasa
  // igualmente porque `dayTotals` lo pide, y así el día que exista no hay que
  // tocar esta llamada.
  //
  // Lo borrado NO entra en los totales: para quien mira, ya no cuenta. Que el
  // total baje en el momento del borrado es además lo que explica el hueco.
  const totals = dayTotals(meals, []);

  return (
    <div className="flex flex-col gap-6">
      <DayTotalsPanel totals={totals} entryCount={meals.length} />

      {MEAL_SLOTS.map((slot) => {
        const inSlot = meals.filter((entry) => entry.slot === slot);
        const deletedInSlot = undoable.filter((entry) => entry.slot === slot);
        return inSlot.length === 0 && deletedInSlot.length === 0 ? null : (
          <SlotSection
            key={slot}
            slot={slot}
            entries={inSlot}
            deleted={deletedInSlot}
            date={date}
            onDeleted={noteDeleted}
            onRestored={forget}
          />
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
  deleted,
  date,
  onDeleted,
  onRestored,
}: {
  slot: MealSlot;
  entries: readonly MealEntry[];
  deleted: readonly MealEntry[];
  date: LocalDate;
  onDeleted: (entry: MealEntry) => void;
  onRestored: (id: MealEntryId) => void;
}) {
  /*
   * Vivos y huecos se mezclan y se ordenan por el momento en que se escribieron,
   * que es el mismo orden que ya usaba la lista. Así el hueco se queda donde
   * estaba la fila en vez de saltar al final, y deshacer devuelve el registro al
   * sitio del que salió.
   */
  const rows = [
    ...entries.map((entry) => ({ kind: 'live' as const, entry })),
    ...deleted.map((entry) => ({ kind: 'deleted' as const, entry })),
  ].sort((a, b) => a.entry.createdAt.localeCompare(b.entry.createdAt));

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        {MEAL_SLOT_LABELS[slot]}
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((row) =>
          row.kind === 'live' ? (
            <EntryRow key={row.entry.id} entry={row.entry} date={date} onDeleted={onDeleted} />
          ) : (
            <DeletedRow key={row.entry.id} entry={row.entry} date={date} onRestored={onRestored} />
          ),
        )}
      </ul>
    </section>
  );
}

/**
 * El hueco que deja un registro borrado, con su deshacer (D-042).
 *
 * Se enseña tachado y apagado en lugar de desaparecer sin más. Un registro que
 * se esfuma deja a quien lo borró sin saber si pasó lo que quería, y sobre todo
 * sin sitio donde volver: el deshacer tiene que estar donde estaba la cosa
 * borrada, no en una esquina de la pantalla.
 */
function DeletedRow({
  entry,
  date,
  onRestored,
}: {
  entry: MealEntry;
  date: LocalDate;
  onRestored: (id: MealEntryId) => void;
}) {
  const restore = useRestoreMeal(date);

  return (
    <li
      // `polite` para que un lector de pantalla anuncie el borrado y el deshacer
      // sin cortar lo que esté leyendo. Sin esto, quien no ve la pantalla se
      // queda sin saber que hay algo que recuperar.
      aria-live="polite"
      className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
    >
      <span className="min-w-0 truncate text-slate-500">
        <span className="line-through">{entry.food.name}</span> · borrado
      </span>
      <button
        type="button"
        onClick={() => {
          restore.mutate(entry.id, {
            // Se olvida solo cuando la escritura ha ido bien. Quitarlo antes de
            // tiempo haría desaparecer el único botón capaz de recuperarlo si la
            // escritura falla.
            onSuccess: () => {
              onRestored(entry.id);
            },
          });
        }}
        disabled={restore.isPending}
        className="shrink-0 text-sm font-medium text-emerald-700 underline underline-offset-4 disabled:text-slate-400"
      >
        Deshacer
      </button>
    </li>
  );
}

function EntryRow({
  entry,
  date,
  onDeleted,
}: {
  entry: MealEntry;
  date: LocalDate;
  onDeleted: (entry: MealEntry) => void;
}) {
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

          {/* Se pregunta antes Y se puede deshacer después, y no son lo mismo
              aunque lo parezcan: la confirmación protege del toque mal dado en
              el móvil, y el deshacer del arrepentimiento inmediato, que al
              registrar comidas es corriente. Una no cubre el caso de la otra
              (D-042). */}
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => {
                  remove.mutate(entry.id, {
                    // Se apunta solo si el borrado se escribió de verdad. Al
                    // revés, un fallo de escritura dejaría en pantalla un hueco
                    // de algo que sigue estando.
                    onSuccess: () => {
                      onDeleted(entry);
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
