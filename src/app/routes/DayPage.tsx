import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { addDays, today, tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { formatLocalDate, formatLocalDateShort } from '@/shared/lib/format-date';
import { currentTimeZone } from '@/shared/lib/time-zone';

/**
 * El diario de un día. De momento solo el marco: la fecha, la navegación entre
 * días y un hueco. Los registros de comida llegan en el paso siguiente.
 *
 * Lo que sí está terminado es la relación entre la URL y el día, que es la parte
 * que D-010 quería tener resuelta pronto: el día vive en la ruta, así que el
 * botón de atrás recorre los días visitados y una fecha concreta se puede
 * guardar en marcadores.
 */
export function DayPage() {
  const { date: rawDate } = useParams<{ date: string }>();
  const date = rawDate === undefined ? undefined : tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate ?? ''} />;
  }

  return <Day date={date} />;
}

function Day({ date }: { date: LocalDate }) {
  const previous = addDays(date, -1);
  const next = addDays(date, 1);
  const isToday = date === today(currentTimeZone());

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Navegación entre días" className="flex items-center justify-between gap-2">
        <DayLink to={previous} rel="prev">
          ← {formatLocalDateShort(previous)}
        </DayLink>
        {isToday ? null : <DayLink to={today(currentTimeZone())}>Hoy</DayLink>}
        <DayLink to={next} rel="next">
          {formatLocalDateShort(next)} →
        </DayLink>
      </nav>

      <header className="flex flex-col gap-1">
        {/* `time` con `dateTime` da la fecha legible por máquinas; el texto de
            dentro es para personas y va en español. */}
        <time dateTime={date} className="text-2xl font-semibold tracking-tight">
          {formatLocalDate(date)}
        </time>
        {isToday ? <p className="text-sm text-slate-500">Hoy</p> : null}
      </header>

      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">
        Todavía no hay registros de este día. El diario llega en el paso siguiente.
      </p>
    </div>
  );
}

function DayLink({ to, rel, children }: { to: LocalDate; rel?: string; children: ReactNode }) {
  return (
    <Link
      to={`/dia/${to}`}
      {...(rel === undefined ? {} : { rel })}
      className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
    >
      {children}
    </Link>
  );
}

/**
 * Una fecha que no existe no se corrige en silencio.
 *
 * Redirigir a hoy sería más cómodo de escribir y peor de usar: si has llegado
 * aquí desde un marcador mal copiado, ver el día de hoy sin más te hace creer
 * que el marcador funcionaba. Se dice qué ha pasado y se ofrece la salida.
 */
function InvalidDate({ raw }: { raw: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Esa fecha no existe</h1>
      <p className="text-slate-600">
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">{raw}</code> no es un día del
        calendario. Las fechas del diario se escriben como año-mes-día, por ejemplo 2026-09-13.
      </p>
      <Link to="/" className="font-medium text-emerald-700 underline underline-offset-4">
        Ir al día de hoy
      </Link>
    </div>
  );
}
