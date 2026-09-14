import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { BarcodeField } from '@/features/food-search/BarcodeField';
import { CatalogResults, SearchResults } from '@/features/food-search/SearchResults';
import {
  EmptyState,
  ErrorState,
  IdleState,
  LoadingState,
  OfflineState,
} from '@/features/food-search/SearchStates';
import { useFoodSearch } from '@/features/food-search/useFoodSearch';
import { useLocalFoodSearch } from '@/features/food-search/useLocalFoodSearch';
import { formatLocalDate } from '@/shared/lib/format-date';
import { isSearchable } from '@/shared/lib/text';
import { normalizeForSearch } from '@contracts/text';

/**
 * Buscar un alimento para un día concreto.
 *
 * La búsqueda cuelga del día en la URL, `/dia/:date/buscar`, y no es una ruta
 * suelta: se busca para añadir algo a un día, así que el día no puede faltar, y
 * el botón de atrás vuelve al diario sin escribir nada. Cada resultado lleva ya
 * al formulario que lo registra, porque encontrar algo y no poder añadirlo no
 * es media funcionalidad, es ninguna.
 *
 * ## Dos búsquedas, no una (D-041)
 *
 * Mientras tecleas se busca **en tu catálogo local**, que es instantáneo, no
 * gasta red y funciona sin conexión. A **Open Food Facts** se sale solo al
 * pulsar Intro o el botón.
 *
 * El motivo está medido: con la versión anterior, que salía a la red por cada
 * texto tecleado pasado por un debounce, escribir "leche entera" con pausas
 * normales producía nueve peticiones, una por prefijo. Y sus condiciones de uso
 * avisan de que no se use su búsqueda mientras se teclea. Lo que cuesta se pide
 * con intención; lo que no cuesta se enseña al instante.
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

  /**
   * Lo que se ha confirmado buscar vive en la URL, y no en un `useState`.
   *
   * Así hay una sola verdad en vez de dos que sincronizar: recargar o compartir
   * el enlace repite exactamente la búsqueda que se llegó a hacer, y desaparece
   * el `useEffect` que antes copiaba el estado a la URL detrás de cada tecla.
   */
  const submitted = params.get('q') ?? '';

  // Lo que se está tecleando ahora mismo. Solo alimenta la búsqueda local.
  const [text, setText] = useState(submitted);

  const local = useLocalFoodSearch(text);
  const { state, retry, isRefreshing } = useFoodSearch(submitted);

  const canSubmit = isSearchable(text);

  function submit() {
    if (!canSubmit) {
      return;
    }
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        // Normalizado también aquí: la URL que se comparte y la clave de caché
        // acaban siendo la misma cosa, así que dos escrituras equivalentes no
        // deben producir dos direcciones distintas.
        next.set('q', normalizeForSearch(text));
        return next;
      },
      // `replace` para no dejar una entrada de historial por búsqueda: el botón
      // de atrás tiene que volver al diario, no deshacer búsquedas una a una.
      { replace: true },
    );
  }

  // Los que ya están en el catálogo no se repiten abajo. `adopt` devuelve el
  // alimento guardado cuando el código de barras ya se conocía (D-034), así que
  // el mismo producto llega con el mismo identificador por las dos vías y sin
  // esto se vería dos veces en la misma pantalla, que parece un fallo.
  const knownIds = new Set(local.foods.map((food) => food.id));

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

      <SearchField
        value={text}
        onChange={setText}
        onSubmit={submit}
        canSubmit={canSubmit}
        busy={isRefreshing}
      />

      <CatalogResults foods={local.foods} searched={local.searched} date={date} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          En Open Food Facts
        </h2>
        {renderRemote()}
      </section>

      <BarcodeField date={date} />
    </div>
  );

  function renderRemote() {
    // `switch` sobre el campo discriminante de la unión: cada rama sabe qué
    // datos tiene disponibles, y si algún día se añade un estado el linter
    // obliga a dibujarlo en vez de dejarlo caer en un caso por defecto.
    switch (state.kind) {
      case 'idle':
        return <IdleState canSubmit={canSubmit} onSubmit={submit} />;
      case 'loading':
        return <LoadingState />;
      case 'offline':
        return <OfflineState />;
      case 'error':
        return <ErrorState error={state.error} onRetry={retry} />;
      case 'empty':
        return <EmptyState query={state.query} />;
      case 'results':
        return <SearchResults page={state.page} date={date} knownIds={knownIds} />;
    }
  }
}

function SearchField({
  value,
  onChange,
  onSubmit,
  canSubmit,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  busy: boolean;
}) {
  return (
    // Un `form` de verdad, y no un campo suelto con un `onKeyDown`: así Intro
    // envía la búsqueda sin código nuestro, que es lo que el navegador ya hace
    // con cualquier formulario, y el botón queda asociado al campo para quien
    // navegue con teclado o con un lector de pantalla.
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="food-search" className="text-sm font-medium text-slate-700">
        Nombre del alimento
      </label>
      <div className="flex gap-2">
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
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          // El texto visible dice "Buscar" porque en el móvil no cabe más, pero
          // el nombre accesible tiene que ser distinto del botón del campo de
          // código de barras, que también dice "Buscar". Dos controles con el
          // mismo nombre en la misma pantalla dejan a quien navega por voz o con
          // lector de pantalla sin forma de decir cuál quiere.
          aria-label="Buscar en Open Food Facts"
          className="shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
        >
          Buscar
        </button>
      </div>
      <span className="h-4 text-xs text-slate-500">
        {busy ? 'Buscando en Open Food Facts…' : null}
      </span>
    </form>
  );
}
