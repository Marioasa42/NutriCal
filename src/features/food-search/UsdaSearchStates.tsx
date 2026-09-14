import { Panel } from '@/features/food-search/SearchStates';
import { MIN_SEARCH_LENGTH } from '@/shared/lib/text';
import { describeUsdaError } from '@/shared/lib/usda-error-messages';

/**
 * Los cuatro estados que no son una lista de resultados, para USDA.
 *
 * Calcado de `SearchStates.tsx`, reutilizando su `Panel` (el marco no dice
 * nada de ninguna fuente) y con el texto propio de USDA en lo demás. Ver el
 * comentario de `useUsdaFoodSearch.ts` sobre por qué esto no se generaliza en
 * un solo componente parametrizado por fuente.
 */

export function UsdaIdleState({
  canSubmit,
  onSubmit,
}: {
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Panel>
      {canSubmit ? (
        <>
          <p className="text-slate-600">
            Pulsa Intro o el botón para buscar también en USDA FoodData Central.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
          >
            Buscar ahora
          </button>
        </>
      ) : (
        <p className="text-slate-600">
          Escribe al menos {MIN_SEARCH_LENGTH} letras para buscar en USDA FoodData Central.
        </p>
      )}
    </Panel>
  );
}

export function UsdaLoadingState() {
  return (
    <Panel>
      <span
        aria-hidden="true"
        className="size-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
      />
      <p className="text-slate-600">Buscando…</p>
    </Panel>
  );
}

export function UsdaOfflineState() {
  return (
    <Panel>
      <p className="font-medium text-slate-900">Sin conexión</p>
      <p className="text-slate-600">
        Buscar alimentos nuevos necesita internet. La búsqueda se reanudará sola en cuanto vuelvas a
        tener red.
      </p>
    </Panel>
  );
}

export function UsdaErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { title, detail, canRetry } = describeUsdaError(error);
  return (
    <Panel>
      <p className="font-medium text-slate-900">{title}</p>
      <p className="text-slate-600">{detail}</p>
      {canRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Volver a intentarlo
        </button>
      ) : null}
    </Panel>
  );
}

export function UsdaEmptyState({ query }: { query: string }) {
  return (
    <Panel>
      <p className="font-medium text-slate-900">Sin resultados para «{query}»</p>
      <p className="text-slate-600">
        USDA FoodData Central no tiene nada con ese nombre. Prueba con menos palabras o en inglés:
        su catálogo está en inglés.
      </p>
    </Panel>
  );
}
