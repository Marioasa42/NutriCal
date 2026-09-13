import type { ReactNode } from 'react';

import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import { formatEnergy, formatGrams, listMacroLabels } from '@/shared/lib/nutrient-format';

/**
 * Un resultado de la búsqueda.
 *
 * Hay dos formas: un `Food` completo y un `FoodDraft` al que le faltan macros
 * del núcleo (D-002). Las dos se enseñan, y esto es deliberado: Open Food Facts
 * trae muchos productos incompletos, y una lista que los esconde parece tener
 * menos resultados de los que hay. Lo que no se puede hacer es enseñarlos
 * apagados y sin explicación, porque un elemento gris sin motivo parece un fallo
 * de la aplicación y no una decisión.
 */

/** El marco común. Ninguna de las dos tarjetas es accionable todavía. */
function Card({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <li
      className={`rounded-lg border p-4 ${
        muted ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
    >
      {children}
    </li>
  );
}

function Title({ name, brand }: { name: string; brand?: string | undefined }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-slate-900">{name}</span>
      {brand === undefined ? null : <span className="text-sm text-slate-500">{brand}</span>}
    </div>
  );
}

/** "por 100 g" o "por 100 ml", según la unidad base del alimento. */
function PerHundred({ unit }: { unit: 'g' | 'ml' }) {
  return <span className="text-xs text-slate-500">por 100 {unit}</span>;
}

export function FoodCard({ food }: { food: Food }) {
  const { macros } = food.per100;
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <Title name={food.name} {...(food.brand === undefined ? {} : { brand: food.brand })} />
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-semibold text-slate-900">{formatEnergy(macros.energy)}</span>
          <PerHundred unit={food.baseUnit} />
        </div>
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <Macro label="Proteínas" value={formatGrams(macros.protein)} />
        <Macro label="Hidratos" value={formatGrams(macros.carbohydrates)} />
        <Macro label="Grasas" value={formatGrams(macros.fat)} />
      </dl>
    </Card>
  );
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <dt>{label}:</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

/**
 * Un producto encontrado al que le faltan cifras obligatorias.
 *
 * La tarjeta dice tres cosas, y las tres hacen falta: que es un resultado de
 * verdad, qué falta exactamente, y cuándo se va a poder arreglar. Sin la tercera,
 * quien lo lea no sabe si esperar algo o darlo por perdido.
 */
export function DraftCard({ draft }: { draft: FoodDraft }) {
  return (
    <Card muted>
      <div className="flex items-start justify-between gap-4">
        <Title name={draft.name} {...(draft.brand === undefined ? {} : { brand: draft.brand })} />
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          Faltan datos
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Open Food Facts no aporta {listMacroLabels(draft.missing)} de este producto. Podrás
        rellenarlo a mano al añadirlo al diario, en el paso siguiente.
      </p>
    </Card>
  );
}
