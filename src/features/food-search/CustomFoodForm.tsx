import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEventHandler } from 'react';
import { useNavigate } from 'react-router';

import { foodRepository } from '@/data/repositories/foods';
import {
  createCustomFood,
  updateCustomFood,
  type CustomFoodInput,
} from '@/domain/food/create-custom-food';
import type { BaseUnit, Food } from '@/domain/food/food';
import { OPTIONAL_MACRO_KEYS, REQUIRED_MACRO_KEYS, type MacroKey } from '@/domain/nutrition/macros';
import {
  MICRONUTRIENT_IDS,
  labelOf,
  unitOf,
  type MicronutrientId,
} from '@/domain/nutrition/micronutrients';
import type { LocalDate } from '@/domain/time/local-date';
import { MACRO_LABELS } from '@/shared/lib/nutrient-format';
import { parseDecimal } from '@/shared/lib/parse-decimal';

/**
 * Crear o editar un alimento propio, sin pasar por Open Food Facts ni USDA.
 *
 * Un único componente para las dos cosas: `initial` trae el alimento que se
 * está editando, o falta si se está creando uno nuevo. Comparte el mismo
 * cuerpo de validación que `create-custom-food.ts` ya comparte entre
 * `createCustomFood`/`updateCustomFood`, así que aquí no se repite ninguna
 * regla, solo se recogen los campos y se enseñan los fallos.
 *
 * Al guardar, navega al formulario de registro -igual que
 * `DraftCompletionForm.tsx` con un producto recién completado-: quien llega
 * aquí desde la búsqueda casi siempre quiere registrarlo ya, no solo
 * guardarlo en el catálogo.
 */

const MACRO_UNITS = {
  energy: 'kcal',
  protein: 'g',
  carbohydrates: 'g',
  fat: 'g',
  sugars: 'g',
  saturatedFat: 'g',
  fiber: 'g',
  salt: 'g',
} as const satisfies Record<MacroKey, string>;

type TextFields = Readonly<Record<string, string>>;

/** Cadena vacía (o solo espacios) significa "no se ha rellenado", no cero. */
function parsedOrUndefined(text: string | undefined): number | undefined {
  const trimmed = (text ?? '').trim();
  return trimmed === '' ? undefined : parseDecimal(trimmed);
}

function fieldsFromFood(food: Food | undefined): {
  name: string;
  brand: string;
  baseUnit: BaseUnit;
  referenceAmount: string;
  macros: TextFields;
  micros: TextFields;
} {
  if (food === undefined) {
    return {
      name: '',
      brand: '',
      baseUnit: 'g',
      referenceAmount: '100',
      macros: {},
      micros: {},
    };
  }

  const { macros, micros } = food.per100;
  return {
    name: food.name,
    brand: food.brand ?? '',
    baseUnit: food.baseUnit,
    referenceAmount: '100',
    macros: Object.fromEntries(
      [...REQUIRED_MACRO_KEYS, ...OPTIONAL_MACRO_KEYS]
        .filter((key) => macros[key] !== undefined)
        .map((key) => [key, String(macros[key])]),
    ),
    micros: Object.fromEntries(
      MICRONUTRIENT_IDS.filter((id) => micros[id] !== undefined).map((id) => [
        id,
        String(micros[id]),
      ]),
    ),
  };
}

export function CustomFoodForm({ date, initial }: { date: LocalDate; initial?: Food }) {
  const navigate = useNavigate();
  const [fields, setFields] = useState(() => fieldsFromFood(initial));
  const [error, setError] = useState<string | undefined>(undefined);

  // `networkMode: 'always'`: esto escribe en IndexedDB, no en la red. Sin
  // esto, sin conexión TanStack Query dejaría la escritura en pausa
  // esperando una red que no hace ninguna falta (ver `features/diary/queries.ts`).
  const save = useMutation({
    mutationFn: (food: Food) => foodRepository.save(food),
    networkMode: 'always',
    onError: () => {
      setError('No se ha podido guardar en este dispositivo. Vuelve a intentarlo.');
    },
  });

  function setMacro(key: MacroKey, value: string) {
    setFields((previous) => ({ ...previous, macros: { ...previous.macros, [key]: value } }));
  }

  function setMicro(id: MicronutrientId, value: string) {
    setFields((previous) => ({ ...previous, micros: { ...previous.micros, [id]: value } }));
  }

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    const input: CustomFoodInput = {
      name: fields.name.trim(),
      ...(fields.brand.trim() !== '' ? { brand: fields.brand.trim() } : {}),
      baseUnit: fields.baseUnit,
      referenceAmount: parseDecimal(fields.referenceAmount),
      macros: Object.fromEntries(
        [...REQUIRED_MACRO_KEYS, ...OPTIONAL_MACRO_KEYS]
          .map((key) => [key, parsedOrUndefined(fields.macros[key])] as const)
          .filter(([, value]) => value !== undefined),
      ),
      micros: Object.fromEntries(
        MICRONUTRIENT_IDS.map((id) => [id, parsedOrUndefined(fields.micros[id])] as const).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    };

    if (input.name === '') {
      setError('Ponle un nombre.');
      return;
    }

    const result =
      initial === undefined ? createCustomFood(input) : updateCustomFood(initial, input);

    switch (result.kind) {
      case 'missingMacros':
        setError(`Todavía falta ${result.missing.map((key) => MACRO_LABELS[key]).join(', ')}.`);
        return;
      case 'invalidReferenceAmount':
        setError('La cantidad de referencia tiene que ser un número mayor que cero.');
        return;
      case 'invalidMacroValue':
        setError(`El valor de ${MACRO_LABELS[result.key]} no es una cantidad válida.`);
        return;
      case 'invalidMicroValue':
        setError(`El valor de ${labelOf(result.key)} no es una cantidad válida.`);
        return;
      case 'created':
        setError(undefined);
        save.mutate(result.food, {
          onSuccess: () => {
            void navigate(`/dia/${date}/registrar/${result.food.id}`);
          },
        });
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      {initial === undefined ? null : (
        <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
          Los cambios no afectan a las comidas que ya registraste con este alimento: quedan tal y
          como estaban.
        </p>
      )}

      <TextInput
        id="custom-food-name"
        label="Nombre"
        value={fields.name}
        onChange={(value) => {
          setFields((previous) => ({ ...previous, name: value }));
        }}
      />

      <TextInput
        id="custom-food-brand"
        label="Marca (opcional)"
        value={fields.brand}
        onChange={(value) => {
          setFields((previous) => ({ ...previous, brand: value }));
        }}
      />

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-medium text-slate-700">Se mide en</legend>
        <div className="flex gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="custom-food-base-unit"
              checked={fields.baseUnit === 'g'}
              onChange={() => {
                setFields((previous) => ({ ...previous, baseUnit: 'g' }));
              }}
            />
            Gramos
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="custom-food-base-unit"
              checked={fields.baseUnit === 'ml'}
              onChange={() => {
                setFields((previous) => ({ ...previous, baseUnit: 'ml' }));
              }}
            />
            Mililitros
          </label>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="custom-food-reference" className="text-sm font-medium text-slate-700">
          Cantidad de referencia ({fields.baseUnit})
        </label>
        <input
          id="custom-food-reference"
          type="text"
          inputMode="decimal"
          value={fields.referenceAmount}
          onChange={(event) => {
            const { value } = event.target;
            setFields((previous) => ({ ...previous, referenceAmount: value }));
          }}
          aria-describedby="custom-food-reference-help"
          className="w-32 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
        <p id="custom-food-reference-help" className="text-xs text-slate-500">
          Escribe la cantidad a la que corresponden los valores que vas a introducir. Si copias una
          etiqueta, suele ser 100 {fields.baseUnit} o el peso de la ración.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-slate-700">
          Por {fields.referenceAmount === '' ? '…' : fields.referenceAmount} {fields.baseUnit}
        </p>
        <div className="flex flex-wrap gap-3">
          {REQUIRED_MACRO_KEYS.map((key) => (
            <MacroInput
              key={key}
              macroKey={key}
              value={fields.macros[key] ?? ''}
              onChange={(value) => {
                setMacro(key, value);
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_MACRO_KEYS.map((key) => (
            <MacroInput
              key={key}
              macroKey={key}
              optional
              value={fields.macros[key] ?? ''}
              onChange={(value) => {
                setMacro(key, value);
              }}
            />
          ))}
        </div>
      </div>

      <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Micronutrientes (opcional)
        </summary>
        <div className="mt-3 flex flex-wrap gap-3">
          {MICRONUTRIENT_IDS.map((id) => (
            <label key={id} className="flex flex-col gap-1">
              <span className="text-sm text-slate-600">
                {labelOf(id)} ({unitOf(id) === 'mg' ? 'mg' : 'µg'})
              </span>
              <input
                value={fields.micros[id] ?? ''}
                onChange={(event) => {
                  setMicro(id, event.target.value);
                }}
                inputMode="decimal"
                autoComplete="off"
                className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              />
            </label>
          ))}
        </div>
      </details>

      {error === undefined ? null : (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {save.isPending
            ? 'Guardando…'
            : initial === undefined
              ? 'Crear y añadir al diario'
              : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        autoComplete="off"
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
    </div>
  );
}

function MacroInput({
  macroKey,
  value,
  onChange,
  optional = false,
}: {
  macroKey: MacroKey;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-slate-600">
        {MACRO_LABELS[macroKey]} ({MACRO_UNITS[macroKey]}){optional ? ', opcional' : ''}
      </span>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        inputMode="decimal"
        autoComplete="off"
        className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
    </label>
  );
}
