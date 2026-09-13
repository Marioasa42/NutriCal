import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { BarcodeField } from '@/features/food-search/BarcodeField';
import { SearchResults } from '@/features/food-search/SearchResults';
import {
  EmptyState,
  ErrorState,
  IdleState,
  LoadingState,
  OfflineState,
} from '@/features/food-search/SearchStates';
import { SEARCH_DEBOUNCE_MS, useFoodSearch } from '@/features/food-search/useFoodSearch';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { formatLocalDate } from '@/shared/lib/format-date';

/**
 * Buscar un alimento para un día concreto.
 *
 * La búsqueda cuelga del día en la URL, `/dia/:date/buscar`, y no es una ruta
 * suelta: se busca para añadir algo a un día, así que el día no puede faltar, y
 * el botón de atrás vuelve al diario sin escribir nada. Seleccionar un resultado
 * y registrarlo llega en el paso siguiente; aquí se cierra encontrar.
 */
export function SearchPage() {
  const { date: rawDate = '' } = useParams<{ date: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <Search date={date} />;
}

function Search({ date }: { date: LocalDate }) {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';

  // Dos textos, y la diferencia es el sentido de todo esto: `text` es lo que
  // estás tecleando y se actualiza en cada letra, para que el campo responda;
  // `query` es lo que hemos decidido buscar, y solo cambia cuando paras.
  const [text, setText] = useState(urlQuery);
  const query = useDebouncedValue(text, SEARCH_DEBOUNCE_MS);

  const { state, retry, isRefreshing } = useFoodSearch(query);

  // La URL refleja lo que se buscó, no lo que se tecleó, para que recargar o
  // compartir el enlace repita la búsqueda que se llegó a hacer.
  //
  // `replace` en vez de una entrada nueva, y esto no es un detalle: sin él,
  // teclear "leche" dejaría cinco entradas en el historial y el botón de atrás
  // desharía la palabra letra a letra en vez de volver al diario.
  useEffect(() => {
    if (query === urlQuery) {
      return;
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (query === '') {
          next.delete('q');
        } else {
          next.set('q', query);
        }
        return next;
      },
      { replace: true },
    );
  }, [query, urlQuery, setParams]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver al día
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Buscar un alimento</h1>
        <p className="text-sm text-slate-500">Para el {formatLocalDate(date)}</p>
      </div>

      <SearchField value={text} onChange={setText} busy={isRefreshing} />

      {renderState()}

      <BarcodeField date={date} />
    </div>
  );

  function renderState() {
    // `switch` sobre el campo discriminante de la unión: cada rama sabe qué
    // datos tiene disponibles, y si algún día se añade un estado el linter
    // obliga a dibujarlo en vez de dejarlo caer en un caso por defecto.
    switch (state.kind) {
      case 'idle':
        return <IdleState />;
      case 'loading':
        return <LoadingState />;
      case 'offline':
        return <OfflineState />;
      case 'error':
        return <ErrorState error={state.error} onRetry={retry} />;
      case 'empty':
        return <EmptyState query={state.query} />;
      case 'results':
        return <SearchResults page={state.page} />;
    }
  }
}

function SearchField({
  value,
  onChange,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="food-search" className="text-sm font-medium text-slate-700">
        Nombre del alimento
      </label>
      <input
        id="food-search"
        type="search"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="leche entera, pan integral…"
        autoComplete="off"
        // `autoFocus` a propósito: a esta pantalla solo se llega pulsando
        // "buscar", así que teclear es lo único que se puede querer hacer aquí.
        autoFocus
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
      />
      <span className="h-4 text-xs text-slate-500">{busy ? 'Actualizando…' : null}</span>
    </div>
  );
}
