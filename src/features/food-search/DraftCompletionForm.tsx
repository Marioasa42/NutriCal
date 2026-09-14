import { useMutation } from '@tanstack/react-query';
import { useState, type SubmitEventHandler } from 'react';
import { useNavigate } from 'react-router';

import { foodRepository } from '@/data/repositories/foods';
import { completeDraft, type FilledMacros } from '@/domain/food/complete-draft';
import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import type { RequiredMacroKey } from '@/domain/nutrition/macros';
import type { LocalDate } from '@/domain/time/local-date';
import { MACRO_LABELS } from '@/shared/lib/nutrient-format';
import { parseDecimal } from '@/shared/lib/parse-decimal';

/**
 * Rellenar a mano lo que la fuente no aporta.
 *
 * Es la interfaz de D-002: un producto incompleto no es un error sino un caso de
 * uso, y este es el formulario que lo resuelve. Lo que se teclee queda marcado
 * como estimación para siempre, porque `completeDraft` guarda las claves
 * rellenadas en `completion.userFilled` y la instantánea del registro se lo
 * lleva consigo. Dentro de un año, la pantalla del día seguirá pudiendo decir
 * cuál de esas cifras la puso una persona y cuál venía del envase.
 *
 * Guarda el alimento en el catálogo y navega al formulario de registro, que es
 * el mismo al que llega un resultado completo. A partir de ahí, un producto
 * completado a mano y uno que venía entero se tratan igual.
 */

/** La unidad de cada macro obligatoria, para que el campo diga qué se espera. */
const UNITS = {
  energy: 'kcal',
  protein: 'g',
  carbohydrates: 'g',
  fat: 'g',
} as const satisfies Record<RequiredMacroKey, string>;

export function DraftCompletionForm({ date, draft }: { date: LocalDate; draft: FoodDraft }) {
  const navigate = useNavigate();
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [failure, setFailure] = useState<string | undefined>(undefined);

  // `networkMode: 'always'` porque esto escribe en IndexedDB: sin ello, sin
  // conexión TanStack Query dejaría la escritura en pausa esperando una red que
  // no hace ninguna falta. Ver la nota de `features/diary/queries.ts`.
  const save = useMutation({
    mutationFn: (food: Food) => foodRepository.save(food),
    networkMode: 'always',
    onError: () => {
      setFailure('No se ha podido guardar en este dispositivo. Vuelve a intentarlo.');
    },
  });

  const filled: FilledMacros = Object.fromEntries(
    draft.missing.map((key) => [key, parseDecimal(values[key] ?? '')]),
  );

  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const result = completeDraft(draft, filled);

    // El `switch` sobre el campo discriminante: cada rama sabe qué dato lleva, y
    // el linter obliga a dibujarlas todas si algún día aparece una cuarta.
    switch (result.kind) {
      case 'stillMissing':
        setFailure(`Todavía falta ${result.missing.map((key) => MACRO_LABELS[key]).join(', ')}.`);
        return;
      case 'invalidValue':
        setFailure(`El valor de ${MACRO_LABELS[result.key]} no es una cantidad válida.`);
        return;
      case 'completed':
        setFailure(undefined);
        save.mutate(result.food, {
          onSuccess: () => {
            void navigate(`/dia/${date}/registrar/${result.food.id}`);
          },
        });
        return;
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm font-medium text-slate-700">
        Rellena lo que falta, por 100 {draft.baseUnit}
      </p>

      <div className="flex flex-wrap gap-3">
        {draft.missing.map((key) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">
              {MACRO_LABELS[key]} ({UNITS[key]})
            </span>
            <input
              name={key}
              value={values[key] ?? ''}
              onChange={(event) => {
                const { value } = event.target;
                setValues((previous) => ({ ...previous, [key]: value }));
              }}
              inputMode="decimal"
              autoComplete="off"
              className="w-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            />
          </label>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Lo que escribas aquí se guardará marcado como estimación, para que no se confunda con un
        dato del envase.
      </p>

      {failure === undefined ? null : (
        <p role="alert" className="text-sm text-red-700">
          {failure}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={save.isPending}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {save.isPending ? 'Guardando…' : 'Guardar y añadir al diario'}
        </button>
      </div>
    </form>
  );
}
