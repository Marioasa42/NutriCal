import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { addDays, today, tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { DayDiary } from '@/features/diary/DayDiary';
import { ExampleDataPanel } from '@/features/diary/ExampleDataPanel';
import { formatLocalDate, formatLocalDateShort } from '@/shared/lib/format-date';
import { currentTimeZone } from '@/shared/lib/time-zone';

/**
 * El diario de un día: la fecha, la navegación entre días y lo registrado.
 *
 * Esta pantalla vive en `app/routes` y no en `features/diary` porque es una
 * pantalla de marco: lo suyo es la relación entre la URL y el día (D-010, D-027).
 * Lo que hay dentro del día lo pone la funcionalidad, en `DayDiary`, y así esta
 * pantalla no crece cada vez que el diario aprenda a enseñar algo nuevo.
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

      <DayDiary date={date} />

      <ExampleDataPanel date={date} />
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
