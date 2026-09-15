import { Link, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { CustomFoodForm } from '@/features/food-search/CustomFoodForm';
import { formatLocalDate } from '@/shared/lib/format-date';

/**
 * Crear un alimento propio desde cero, sin pasar por Open Food Facts ni USDA.
 *
 * `FoodSource` tiene la rama `'custom'` desde el diseño del dominio, pero
 * hasta ahora solo la usaba el sembrado de ejemplo: esta es la primera
 * pantalla que la pone al alcance de cualquiera.
 */
export function CreateFoodPage() {
  const { date: rawDate = '' } = useParams<{ date: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <CreateFood date={date} />;
}

function CreateFood({ date }: { date: LocalDate }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}/buscar`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver a buscar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Crear mi propio alimento</h1>
        <p className="text-sm text-slate-500">Para el {formatLocalDate(date)}</p>
      </div>

      <CustomFoodForm date={date} />
    </div>
  );
}
