import type { DayTotals } from '@/domain/diary/day';
import { labelOf } from '@/domain/nutrition/micronutrients';
import { buildMicronutrientPanel, type MicronutrientRow } from '@/domain/nutrition/micronutrient-panel';
import type { LocalDate } from '@/domain/time/local-date';
import { useGoalsQuery } from '@/features/goals/queries';
import { useProfile } from '@/features/profile/profile-context';
import { formatMicronutrient } from '@/shared/lib/nutrient-format';
import { UnknownNote } from '@/shared/ui/NutrientValue';

/**
 * El panel de micronutrientes del día.
 *
 * ## Barras hechas a mano, no Recharts (decisión 12)
 *
 * CLAUDE.md pone Recharts como librería de gráficas del proyecto, pero una
 * barra de progreso hacia un objetivo no es una gráfica: es un `div` con un
 * ancho en porcentaje. Traer una librería entera, con su SVG, su tamaño de
 * paquete y su propia forma de anotar accesibilidad, por veintidós barras
 * sencillas habría sido la dependencia que CLAUDE.md pide justificar y aquí
 * no se sostiene. Y hay un motivo más fuerte que el tamaño: D-026 exige que
 * ninguna barra se pueda dibujar sin su recuento de "unknown", y esa garantía
 * es mucho más fácil de sostener "por construcción" en un componente propio,
 * donde `MicronutrientRow` obliga a pasar el dato, que confiando en que la
 * configuración de una librería externa siempre incluya la anotación
 * correcta. Recharts sigue siendo lo que toca para series temporales de
 * verdad, cuando lleguen.
 *
 * ## Qué hace `useGoalsQuery` aquí y por qué su fallo no bloquea el panel
 *
 * Si la lectura de los objetivos está en curso, ha fallado, o simplemente no
 * hay ninguna versión todavía (un perfil recién creado), `goals` vale
 * `undefined` en los tres casos por igual, y `buildMicronutrientPanel` ya sabe
 * qué hacer con eso: usar los valores de referencia oficiales (decisión 13).
 * Bloquear el panel entero por un fallo de lectura de un dato que tiene una
 * alternativa perfectamente válida sería peor que degradarse con elegancia.
 */
export function MicronutrientPanel({
  date,
  totals,
  entryCount,
}: {
  date: LocalDate;
  totals: DayTotals;
  entryCount: number;
}) {
  const goalsQuery = useGoalsQuery(date);
  const profile = useProfile();
  const sex = profile.body?.sex ?? 'unspecified';

  const rows = buildMicronutrientPanel(totals, entryCount, sex, goalsQuery.data);
  const withData = rows.filter((row) => row.kind === 'known');
  const withoutData = rows.filter((row) => row.kind === 'noData');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-700">Micronutrientes</h2>

      {withData.length === 0 ? (
        <p className="text-sm text-slate-500">
          Todavía no hay datos de micronutrientes para hoy. Suelen venir de fuentes que no siempre
          los declaran todos.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100">
          {withData.map((row) => (
            <li key={row.id}>
              <MicronutrientBar row={row} />
            </li>
          ))}
        </ul>
      )}

      {withoutData.length === 0 ? null : (
        // Un desplegable, no veintidós barras diciendo "sin datos": la
        // mayoría de los registros de una sola fuente no traen el panel
        // completo (el yodo, por ejemplo, nunca lo trae desde USDA, D-048), y
        // enseñarlo así habría enterrado las barras que sí dicen algo bajo
        // una pared de ausencias. Pendiente de revisión: es una elección de
        // presentación conservadora, no una decisión ya aprobada.
        <details className="mt-3 text-sm text-slate-500">
          <summary className="cursor-pointer select-none">
            {withoutData.length === 1
              ? 'Un micronutriente sin datos hoy'
              : `${withoutData.length} micronutrientes sin datos hoy`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 pl-4">
            {withoutData.map((row) => (
              <li key={row.id}>{labelOf(row.id)}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function MicronutrientBar({ row }: { row: Extract<MicronutrientRow, { kind: 'known' }> }) {
  const { id, amount, unknownCount, totalEntries, target, targetSource, upperLimit, percentOfTarget } =
    row;

  // La barra nunca se sale del contenedor, aunque el día vaya muy por encima
  // del objetivo: un 340% de ancho rompería el diseño. La cifra de al lado sí
  // dice el porcentaje real, sin recortar.
  const widthPercent = Math.max(0, Math.min(percentOfTarget, 100));
  const overLimit = upperLimit !== undefined && amount > upperLimit;

  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-600">
          {labelOf(id)}
          {unknownCount > 0 ? <UnknownNote missing={unknownCount} total={totalEntries} /> : null}
        </span>
        <span className={`text-sm font-medium ${overLimit ? 'text-red-700' : 'text-slate-900'}`}>
          {formatMicronutrient(id, amount)} · {Math.round(percentOfTarget)} %
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${overLimit ? 'bg-red-500' : 'bg-emerald-600'}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>

      <span className="text-xs text-slate-400">
        Objetivo: {formatMicronutrient(id, target)} (
        {targetSource === 'goal' ? 'tu objetivo' : 'referencia oficial'})
        {overLimit ? ' — por encima del límite superior tolerable' : ''}
      </span>
    </div>
  );
}
