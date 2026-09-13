import type { ReactNode } from 'react';

import { MIN_SEARCH_LENGTH } from '@/shared/lib/text';
import { describeOffError } from '@/shared/lib/off-error-messages';

/**
 * Los cuatro estados que no son una lista de resultados.
 *
 * Están escritos desde el principio y no añadidos después porque son la mayor
 * parte del tiempo que la pantalla pasa viva: se empieza en `idle`, se pasa por
 * `loading` en cada búsqueda, y `empty` y `error` son tan normales como acertar.
 * Una pantalla que solo sabe dibujar el caso bueno hay que rehacerla entera para
 * enseñar los otros.
 */

function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      // `polite` para que un lector de pantalla anuncie el cambio de estado sin
      // interrumpir lo que esté leyendo.
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 p-8 text-center"
    >
      {children}
    </div>
  );
}

export function IdleState() {
  return (
    <Panel>
      <p className="text-slate-600">
        Escribe al menos {MIN_SEARCH_LENGTH} letras para buscar en Open Food Facts.
      </p>
    </Panel>
  );
}

export function LoadingState() {
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

/**
 * Sin conexión no es un error, es una espera.
 *
 * TanStack Query no llega a lanzar la petición cuando el navegador dice que no
 * hay red: la deja en pausa y la reanuda sola al volver. Por eso aquí no hay
 * botón de reintentar. Ponerlo sería prometer algo que no depende de pulsarlo.
 */
export function OfflineState() {
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

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { title, detail, canRetry } = describeOffError(error);
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

export function EmptyState({ query }: { query: string }) {
  return (
    <Panel>
      <p className="font-medium text-slate-900">Sin resultados para «{query}»</p>
      <p className="text-slate-600">
        Open Food Facts no tiene nada con ese nombre. Prueba con menos palabras o con el nombre del
        producto tal y como viene en el envase.
      </p>
    </Panel>
  );
}
