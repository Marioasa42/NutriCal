import type { ReactNode } from 'react';

import type { FoodDraft } from '@/domain/food/draft';
import type { Food, FoodSource } from '@/domain/food/food';
import { displayFoodName } from '@/services/usda/food-terms';
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
 *
 * Lo que se puede hacer con el resultado llega por `action`, como un hueco que
 * rellena quien usa la tarjeta. La búsqueda pone un enlace para añadirlo al
 * diario y la pantalla de un código de barras pone el formulario que completa
 * lo que falta. La tarjeta no sabe cuál de las dos cosas es, y así la misma
 * sirve en las dos pantallas sin llevar dentro una bandera por cada sitio desde
 * el que se la llama.
 */

/** El marco común, con un hueco al final para la acción que corresponda. */
function Card({
  children,
  action,
  muted = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li
      className={`rounded-lg border p-4 ${
        muted ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
      }`}
    >
      {children}
      {action === undefined ? null : <div className="mt-3">{action}</div>}
    </li>
  );
}

/**
 * `displayFoodName` añade la pista en español entre paréntesis solo para
 * alimentos de USDA (D-049): el nombre de la fuente va siempre primero y
 * entero, la pista es una nota, nunca un reemplazo.
 */
function Title({
  name,
  source,
  brand,
}: {
  name: string;
  source: FoodSource;
  brand?: string | undefined;
}) {
  return (
    <div className="flex flex-col">
      <span className="font-medium text-slate-900">{displayFoodName({ name, source })}</span>
      {brand === undefined ? null : <span className="text-sm text-slate-500">{brand}</span>}
    </div>
  );
}

/** "por 100 g" o "por 100 ml", según la unidad base del alimento. */
function PerHundred({ unit }: { unit: 'g' | 'ml' }) {
  return <span className="text-xs text-slate-500">por 100 {unit}</span>;
}

export function FoodCard({
  food,
  action,
  note,
}: {
  food: Food;
  action?: ReactNode;
  /** Un aviso corto bajo las macros. Hoy lo usa USDA para decir que los micronutrientes llegan al añadir (D-048). */
  note?: string;
}) {
  const { macros } = food.per100;
  return (
    <Card action={action}>
      <div className="flex items-start justify-between gap-4">
        <Title
          name={food.name}
          source={food.source}
          {...(food.brand === undefined ? {} : { brand: food.brand })}
        />
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
      {note === undefined ? null : <p className="mt-2 text-xs text-slate-500">{note}</p>}
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
export function DraftCard({ draft, action }: { draft: FoodDraft; action?: ReactNode }) {
  return (
    <Card muted action={action}>
      <div className="flex items-start justify-between gap-4">
        <Title
          name={draft.name}
          source={draft.source}
          {...(draft.brand === undefined ? {} : { brand: draft.brand })}
        />
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          Faltan datos
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Open Food Facts no aporta {listMacroLabels(draft.missing)} de este producto. Puedes
        rellenarlo a mano y quedará marcado como estimación.
      </p>
    </Card>
  );
}
