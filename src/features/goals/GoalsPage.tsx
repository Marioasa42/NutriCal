import { useState } from 'react';
import { Link } from 'react-router';

import type { DailyGoals } from '@/domain/goals/goals';
import { isEnergyGoalAllowed, minEnergyGoalFor } from '@/domain/goals/goals';
import { newGoalsId } from '@/domain/identity/ids';
import { now, today, type LocalDate } from '@/domain/time/local-date';
import { grams, kilocalories } from '@/domain/units/units';
import { parseGoalsForm, type GoalsFormFields } from '@/features/goals/goals-form';
import { useGoalsQuery, useSaveGoals } from '@/features/goals/queries';
import { useProfile, useTimeZone } from '@/features/profile/profile-context';

/**
 * Objetivos diarios, editables sin límite y sin necesidad de suscripción.
 *
 * Solo las cuatro macros y la fibra son editables aquí. El panel de
 * micronutrientes de la fase 2 (D-048, pendiente de cablear) usa los valores
 * de referencia oficiales de `reference-intakes.ts` cuando no hay un objetivo
 * propio (decisión 13), así que fijar un objetivo por micronutriente no hace
 * falta todavía para que ese panel funcione, y no se pide aquí: es una
 * pantalla más para rellenar sin necesidad real, justo lo que D-016 del
 * proyecto pide evitar. Si algún día hace falta, `DailyGoals.micros` ya tiene
 * sitio para guardarlo sin cambiar el modelo.
 *
 * Cada "Guardar" no edita: crea una versión nueva con `effectiveFrom` en el
 * día de hoy, según D-004. Es el motivo por el que `goalsEffectiveOn` tiene
 * que desempatar por `updatedAt` (decisión 10): editar dos veces el mismo día
 * es el camino normal de esta pantalla, no un caso raro.
 */
export function GoalsPage() {
  const timeZone = useTimeZone();
  const date = today(timeZone);
  const query = useGoalsQuery(date);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/" className="text-sm font-medium text-emerald-700 underline underline-offset-4">
          ← Volver al diario
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Objetivos diarios</h1>
        <p className="text-sm text-slate-500">
          Totalmente tuyos: sin mínimos artificiales más que el de seguridad, y sin que nada premie
          fijarlos más bajos.
        </p>
      </div>

      {query.isPending ? (
        <p className="text-sm text-slate-500">Cargando tus objetivos…</p>
      ) : query.isError ? (
        <p className="text-sm text-red-700">
          No se han podido leer tus objetivos. Vuelve a intentarlo.
        </p>
      ) : (
        <GoalsForm date={date} current={query.data} />
      )}
    </div>
  );
}

function toFieldValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function GoalsForm({ date, current }: { date: LocalDate; current: DailyGoals | undefined }) {
  const profile = useProfile();
  const save = useSaveGoals();
  const sex = profile.body?.sex ?? 'unspecified';
  const floor = minEnergyGoalFor(sex);

  const [fields, setFields] = useState<GoalsFormFields>({
    energy: toFieldValue(current?.energy),
    protein: toFieldValue(current?.protein),
    carbohydrates: toFieldValue(current?.carbohydrates),
    fat: toFieldValue(current?.fat),
    fiber: toFieldValue(current?.fiber),
  });

  function setField(key: keyof GoalsFormFields, value: string) {
    setFields((previous) => ({ ...previous, [key]: value }));
  }

  const parsed = parseGoalsForm(fields);
  const energyAllowed =
    parsed.kind === 'valid' ? isEnergyGoalAllowed(kilocalories(parsed.values.energy), sex) : true;
  const canSubmit = parsed.kind === 'valid' && energyAllowed;

  function submit() {
    if (parsed.kind !== 'valid' || !energyAllowed) {
      return;
    }
    const { values } = parsed;
    const at = now();
    const goals: DailyGoals = {
      id: newGoalsId(),
      effectiveFrom: date,
      energy: kilocalories(values.energy),
      protein: grams(values.protein),
      carbohydrates: grams(values.carbohydrates),
      fat: grams(values.fat),
      ...(values.fiber !== undefined ? { fiber: grams(values.fiber) } : {}),
      // Esta pantalla no toca los micronutrientes: lo que hubiera se conserva
      // tal cual en la versión nueva, en vez de perderse por editar una macro.
      micros: current?.micros ?? {},
      origin: { kind: 'manual' },
      createdAt: at,
      updatedAt: at,
    };
    save.mutate(goals);
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <NumberField
        id="goal-energy"
        label="Energía (kcal)"
        value={fields.energy}
        onChange={(value) => {
          setField('energy', value);
        }}
        help={`El mínimo que permite la aplicación es ${floor} kcal.`}
        {...(parsed.kind === 'valid' && !energyAllowed
          ? {
              error: `No se puede bajar de ${floor} kcal. Por debajo de eso hace falta supervisión médica.`,
            }
          : {})}
      />
      <NumberField
        id="goal-protein"
        label="Proteína (g)"
        value={fields.protein}
        onChange={(value) => {
          setField('protein', value);
        }}
      />
      <NumberField
        id="goal-carbohydrates"
        label="Hidratos de carbono (g)"
        value={fields.carbohydrates}
        onChange={(value) => {
          setField('carbohydrates', value);
        }}
      />
      <NumberField
        id="goal-fat"
        label="Grasa (g)"
        value={fields.fat}
        onChange={(value) => {
          setField('fat', value);
        }}
      />
      <NumberField
        id="goal-fiber"
        label="Fibra (g), opcional"
        value={fields.fiber}
        onChange={(value) => {
          setField('fiber', value);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || save.isPending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
        >
          Guardar
        </button>
        <span aria-live="polite" className="text-sm text-slate-500">
          {save.isError ? 'No se ha podido guardar.' : null}
          {save.isSuccess ? 'Guardado.' : null}
        </span>
      </div>
    </form>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  help,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
      {help !== undefined && error === undefined ? (
        <p className="text-xs text-slate-500">{help}</p>
      ) : null}
      {error !== undefined ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
