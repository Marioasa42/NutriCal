import type { LocalDate } from '@/domain/time/local-date';
import { useExampleData, useExampleDataLoaded } from '@/features/diary/queries';
import { formatLocalDateShort } from '@/shared/lib/format-date';

/**
 * Poner y quitar los datos de ejemplo.
 *
 * Existe por D-016: cada previsualización de Vercel vive en su propio origen y
 * arranca con IndexedDB vacía, así que quien abre el enlace de un pull request o
 * la demo del portfolio se encuentra una pantalla en blanco. Con esto, se
 * encuentra un día con contenido en dos pulsaciones.
 *
 * Nunca se carga solo, y eso es media decisión: precargar datos inventados al
 * abrir los mezclaría con los de la persona usuaria sin que lo hubiera pedido, y
 * en una aplicación donde el diario es de quien lo escribe eso no se hace.
 *
 * El panel dice también en qué día va a escribir. Sin esa frase, pulsar el botón
 * mirando el martes y ver aparecer cosas sería un pequeño misterio.
 */
export function ExampleDataPanel({ date }: { date: LocalDate }) {
  const loaded = useExampleDataLoaded();
  const example = useExampleData(date);

  if (loaded.isPending || loaded.isError) {
    return null;
  }

  return (
    <aside className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-100 p-3 text-sm">
      <p className="text-slate-600">
        {loaded.data
          ? 'Estás viendo datos de ejemplo, no los tuyos.'
          : `¿Quieres ver cómo queda un día con datos? Se escribirán en el ${formatLocalDateShort(date)}.`}
      </p>
      <button
        type="button"
        disabled={example.isPending}
        onClick={() => {
          example.mutate(loaded.data ? 'unload' : 'load');
        }}
        className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {example.isPending
          ? 'Un momento…'
          : loaded.data
            ? 'Borrar los datos de ejemplo'
            : 'Cargar datos de ejemplo'}
      </button>
    </aside>
  );
}
