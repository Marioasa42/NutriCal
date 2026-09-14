import { useState, type ReactNode, type SubmitEventHandler } from 'react';

import {
  DEFAULT_PORTION_AMOUNT,
  type MealEntryCreation,
  type PortionChoice,
} from '@/domain/diary/log-meal';
import { MEAL_SLOTS, type MealEntry, type MealSlot } from '@/domain/diary/meal-entry';
import { entryTotals } from '@/domain/diary/totals';
import { isUserFilled, type Food } from '@/domain/food/food';
import type { ServingId } from '@/domain/identity/ids';
import { OPTIONAL_MACRO_KEYS } from '@/domain/nutrition/macros';
import { useSaveMeal } from '@/features/diary/queries';
import { MEAL_SLOT_LABELS } from '@/shared/lib/meal-labels';
import {
  MACRO_LABELS,
  formatEnergy,
  formatGrams,
  formatQuantity,
} from '@/shared/lib/nutrient-format';
import { parseDecimal } from '@/shared/lib/parse-decimal';
import { NutrientValue } from '@/shared/ui/NutrientValue';

/**
 * Elegir momento del día y cantidad, ver lo que eso supone, y guardar.
 *
 * La idea que sostiene este archivo: **la vista previa es el registro que se va
 * a guardar**. No hay un cálculo para enseñar y otro para escribir. En cada
 * pulsación se construye el registro entero con `build`, y lo que se pinta son
 * sus totales; al enviar se construye otra vez, con el reloj y el identificador
 * de verdad, y se guarda. Así es imposible que lo que viste y lo que se guardó
 * salgan de dos fórmulas distintas, que es el fallo que D-003 quiere evitar en
 * la base de datos y este es el mismo de la parte de arriba.
 *
 * Por eso `build` llega como propiedad en vez de llamar aquí a
 * `createMealEntry`: quien registra algo nuevo pasa una función y quien edite un
 * registro existente pasará otra, sin tocar nada de esta pantalla.
 */

export interface EntryFormProps {
  readonly food: Food;
  readonly initialSlot?: MealSlot;
  readonly initialChoice?: PortionChoice;
  readonly submitLabel: string;
  readonly build: (slot: MealSlot, choice: PortionChoice) => MealEntryCreation;
  readonly onSaved: (entry: MealEntry) => void;
}

export function EntryForm({
  food,
  initialSlot = 'breakfast',
  initialChoice,
  submitLabel,
  build,
  onSaved,
}: EntryFormProps) {
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [mode, setMode] = useState<PortionChoice['kind']>(initialChoice?.kind ?? 'baseUnit');
  const [amount, setAmount] = useState(
    initialChoice?.kind === 'baseUnit'
      ? String(initialChoice.amount)
      : String(DEFAULT_PORTION_AMOUNT),
  );
  const [servingId, setServingId] = useState<ServingId | undefined>(
    initialChoice?.kind === 'serving' ? initialChoice.servingId : food.servings[0]?.id,
  );
  const [count, setCount] = useState(
    initialChoice?.kind === 'serving' ? String(initialChoice.count) : '1',
  );

  const save = useSaveMeal();

  const choice: PortionChoice =
    mode === 'serving' && servingId !== undefined
      ? { kind: 'serving', servingId, count: parseDecimal(count) }
      : { kind: 'baseUnit', amount: parseDecimal(amount) };

  const built = build(slot, choice);

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    // Se construye otra vez, y no se guarda el de la vista previa: ese lleva el
    // reloj y el identificador que le tocaran al último renderizado.
    const result = build(slot, choice);
    if (result.kind !== 'created') {
      return;
    }
    save.mutate(result.entry, {
      onSuccess: () => {
        onSaved(result.entry);
      },
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-700">¿En qué momento del día?</legend>
        <div className="flex flex-wrap gap-2">
          {MEAL_SLOTS.map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                slot === option
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="slot"
                value={option}
                checked={slot === option}
                onChange={() => {
                  setSlot(option);
                }}
                className="sr-only"
              />
              {MEAL_SLOT_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-slate-700">¿Cuánto?</legend>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm text-slate-600">Cantidad</span>
            <div className="flex items-center gap-2">
              <input
                name="amount"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setMode('baseUnit');
                }}
                onFocus={() => {
                  setMode('baseUnit');
                }}
                inputMode="decimal"
                autoComplete="off"
                className={`w-32 rounded-md border bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-200 ${
                  mode === 'baseUnit' ? 'border-emerald-600' : 'border-slate-300'
                }`}
              />
              <span className="text-sm text-slate-600">{food.baseUnit}</span>
            </div>
          </label>
        </div>

        {/* Las porciones solo se ofrecen si el alimento trae alguna. Un desplegable
            vacío sería una promesa que la fuente no siempre cumple. */}
        {food.servings.length > 0 && servingId !== undefined ? (
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">Raciones</span>
              <input
                name="count"
                value={count}
                onChange={(event) => {
                  setCount(event.target.value);
                  setMode('serving');
                }}
                onFocus={() => {
                  setMode('serving');
                }}
                inputMode="decimal"
                autoComplete="off"
                className={`w-20 rounded-md border bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-200 ${
                  mode === 'serving' ? 'border-emerald-600' : 'border-slate-300'
                }`}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm text-slate-600">de</span>
              <select
                name="serving"
                value={servingId}
                onChange={(event) => {
                  setServingId(event.target.value as ServingId);
                  setMode('serving');
                }}
                className={`w-full rounded-md border bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-emerald-200 ${
                  mode === 'serving' ? 'border-emerald-600' : 'border-slate-300'
                }`}
              >
                {food.servings.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({formatQuantity(option.amountInBaseUnit, food.baseUnit)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </fieldset>

      <Preview built={built} food={food} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={built.kind !== 'created' || save.isPending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {save.isPending ? 'Guardando…' : submitLabel}
        </button>
        {save.isError ? (
          <p role="alert" className="text-sm text-red-700">
            No se ha podido guardar en este dispositivo. Vuelve a intentarlo.
          </p>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Lo que supone lo elegido, o por qué todavía no supone nada.
 *
 * Las tres ramas de fallo vienen del dominio con su dato dentro, así que el
 * mensaje puede ser concreto en lugar de un "revisa los campos" genérico.
 */
function Preview({ built, food }: { built: MealEntryCreation; food: Food }) {
  if (built.kind === 'invalidAmount') {
    return <PreviewNote>Escribe cuánto vas a registrar, en {food.baseUnit}.</PreviewNote>;
  }
  if (built.kind === 'invalidCount') {
    return <PreviewNote>El número de raciones tiene que ser mayor que cero.</PreviewNote>;
  }
  if (built.kind === 'unknownServing') {
    return <PreviewNote>Esa ración ya no existe en este alimento. Elige otra.</PreviewNote>;
  }

  const { entry } = built;
  const { macros } = entryTotals(entry);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="mb-2 text-sm font-medium text-slate-700">
        Esto es lo que se va a registrar (
        {formatQuantity(entry.portion.amountInBaseUnit, entry.food.baseUnit)})
      </p>
      <dl>
        {/* `estimated` sale de la instantánea, no del alimento: es la copia que se
            va a guardar, y es la que seguirá contando la verdad dentro de un año. */}
        <NutrientValue
          label={MACRO_LABELS.energy}
          value={formatEnergy(macros.energy)}
          estimated={isUserFilled(entry.food, 'energy')}
        />
        <NutrientValue
          label={MACRO_LABELS.protein}
          value={formatGrams(macros.protein)}
          estimated={isUserFilled(entry.food, 'protein')}
        />
        <NutrientValue
          label={MACRO_LABELS.carbohydrates}
          value={formatGrams(macros.carbohydrates)}
          estimated={isUserFilled(entry.food, 'carbohydrates')}
        />
        <NutrientValue
          label={MACRO_LABELS.fat}
          value={formatGrams(macros.fat)}
          estimated={isUserFilled(entry.food, 'fat')}
        />
        {OPTIONAL_MACRO_KEYS.map((key) => {
          const value = macros[key];
          return value === undefined ? null : (
            <NutrientValue
              key={key}
              label={MACRO_LABELS[key]}
              value={formatGrams(value)}
              estimated={isUserFilled(entry.food, key)}
            />
          );
        })}
      </dl>
    </div>
  );
}

function PreviewNote({ children }: { children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600"
    >
      {children}
    </p>
  );
}
