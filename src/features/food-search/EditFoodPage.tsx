import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import { foodKeys, foodRepository } from '@/data/repositories/foods';
import type { FoodId } from '@/domain/identity/ids';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { CustomFoodForm } from '@/features/food-search/CustomFoodForm';
import { formatLocalDate } from '@/shared/lib/format-date';

/**
 * Editar un alimento propio ya existente.
 *
 * Solo alimentos con `source.kind === 'custom'`: los de Open Food Facts o
 * USDA no se editan aquí -eso sería otra funcionalidad, cambiar los datos de
 * la fuente, y no la que pide esta tarea-.
 *
 * No usa `useCatalogFood` de `features/diary/` (D-027: la dirección de las
 * dependencias entre funcionalidades no cruza), así que la consulta se
 * repite aquí, calcada, con la misma clave de caché (`foodKeys.byId`) para
 * que las dos pantallas compartan la misma entrada si el alimento ya estaba
 * en caché.
 */
export function EditFoodPage() {
  const { date: rawDate = '', foodId = '' } = useParams<{ date: string; foodId: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <EditFood date={date} foodId={foodId as FoodId} />;
}

function EditFood({ date, foodId }: { date: LocalDate; foodId: FoodId }) {
  const {
    data: food,
    isPending,
    isError,
  } = useQuery({
    queryKey: foodKeys.byId(foodId),
    queryFn: () => foodRepository.byId(foodId),
    networkMode: 'always',
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}/buscar`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver a buscar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar alimento</h1>
        <p className="text-sm text-slate-500">Para el {formatLocalDate(date)}</p>
      </div>

      {renderState()}
    </div>
  );

  function renderState() {
    if (isPending) {
      return <Panel>Buscando el alimento en tu dispositivo…</Panel>;
    }
    if (isError) {
      return (
        <Panel>
          No hemos podido leer el catálogo de este dispositivo. Si estás en una ventana privada,
          puede que el almacenamiento esté bloqueado.
        </Panel>
      );
    }
    if (food?.source.kind !== 'custom') {
      return <NotEditable date={date} />;
    }
    return <CustomFoodForm date={date} initial={food} />;
  }
}

function NotEditable({ date }: { date: LocalDate }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-300 p-6">
      <p className="font-medium text-slate-900">Ese alimento no se puede editar aquí</p>
      <p className="text-slate-600">
        Solo se editan los alimentos propios, creados desde cero. Los que vienen de Open Food Facts
        o de USDA FoodData Central no.
      </p>
      <Link
        to={`/dia/${date}/buscar`}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Volver a buscar
      </Link>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <p
      aria-live="polite"
      className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-600"
    >
      {children}
    </p>
  );
}
