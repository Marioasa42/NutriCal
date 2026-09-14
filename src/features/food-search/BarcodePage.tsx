import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { InvalidDate } from '@/app/routes/InvalidDate';
import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import { tryLocalDate, type LocalDate } from '@/domain/time/local-date';
import { DraftCompletionForm } from '@/features/food-search/DraftCompletionForm';
import { DraftCard, FoodCard } from '@/features/food-search/FoodResultCard';
import { AddToDiaryLink } from '@/features/food-search/ResultActions';
import { ErrorState, LoadingState, OfflineState } from '@/features/food-search/SearchStates';
import { useBarcodeLookup } from '@/features/food-search/useBarcodeLookup';
import { formatLocalDate } from '@/shared/lib/format-date';
import { BARCODE_MAX_DIGITS, BARCODE_MIN_DIGITS } from '@contracts/barcode';

/**
 * Resolver un código de barras.
 *
 * Esta ruta, `/dia/:date/codigo/:barcode`, es EL punto de entrada de un código
 * de barras, y está pensada para tener más de un productor. Hoy solo hay uno,
 * el formulario donde se teclea. En la fase 3 el escáner de cámara será el
 * segundo, y no tendrá que tocar nada de este archivo: detectará una cadena y
 * navegará aquí.
 *
 * Por eso el código viaja en la URL y no en el estado de un diálogo. Una función
 * a la que se llama obliga a quien la llama a conocer el estado interno de la
 * pantalla; una dirección solo pide una cadena. Y de paso el resultado se puede
 * recargar y compartir, y el botón de atrás vuelve a la búsqueda.
 */
export function BarcodePage() {
  const { date: rawDate = '', barcode = '' } = useParams<{ date: string; barcode: string }>();
  const date = tryLocalDate(rawDate);

  if (date === undefined) {
    return <InvalidDate raw={rawDate} />;
  }

  return <Lookup date={date} barcode={barcode} />;
}

function Lookup({ date, barcode }: { date: LocalDate; barcode: string }) {
  const { state, retry } = useBarcodeLookup(barcode);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          to={`/dia/${date}/buscar`}
          className="text-sm font-medium text-emerald-700 underline underline-offset-4"
        >
          ← Volver a buscar
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Código {barcode}</h1>
        <p className="text-sm text-slate-500">Para el {formatLocalDate(date)}</p>
      </div>

      {renderState()}
    </div>
  );

  function renderState() {
    switch (state.kind) {
      case 'invalid':
        return <InvalidBarcode barcode={state.barcode} />;
      case 'loading':
        return <LoadingState />;
      case 'offline':
        return <OfflineState />;
      case 'error':
        return <ErrorState error={state.error} onRetry={retry} />;
      case 'notFound':
        return <NotFound barcode={state.barcode} />;
      case 'unreadable':
        return <Unreadable reason={state.reason} />;
      case 'complete':
        return <Found date={date} food={state.food} />;
      case 'needsCompletion':
        return <FoundDraft date={date} draft={state.draft} />;
    }
  }
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 p-8 text-center"
    >
      {children}
    </div>
  );
}

/**
 * El código de la URL no cumple la regla, así que no se ha hecho ninguna
 * petición. Es la mitad del cliente de la regla compartida: el servidor la
 * aplicaría igual, pero para saberlo habría que preguntárselo.
 */
function InvalidBarcode({ barcode }: { barcode: string }) {
  return (
    <Panel>
      <p className="font-medium text-slate-900">Eso no es un código de barras</p>
      <p className="text-slate-600">
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">{barcode}</code> no tiene la
        forma de un código de producto. Son entre {BARCODE_MIN_DIGITS} y {BARCODE_MAX_DIGITS}{' '}
        dígitos, sin letras.
      </p>
    </Panel>
  );
}

/** La fuente no conoce el código. No es un fallo: es una respuesta. */
function NotFound({ barcode }: { barcode: string }) {
  return (
    <Panel>
      <p className="font-medium text-slate-900">No lo encontramos</p>
      <p className="text-slate-600">
        Open Food Facts no tiene ningún producto con el código {barcode}. Comprueba que lo has
        copiado bien; crear un alimento a mano desde cero llega más adelante.
      </p>
    </Panel>
  );
}

/**
 * Lo encontramos, pero la fuente lo devuelve tan roto que no se puede leer.
 *
 * Es distinto de no encontrarlo, y por eso tiene su propio mensaje: aquí volver
 * a intentarlo no sirve de nada, porque el problema está en el dato guardado,
 * no en la petición.
 */
function Unreadable({ reason }: { reason: string }) {
  return (
    <Panel>
      <p className="font-medium text-slate-900">Lo encontramos, pero no lo entendemos</p>
      <p className="text-slate-600">
        Open Food Facts tiene ese código, pero los datos que devuelve no se pueden interpretar (
        {reason}). Busca el producto por su nombre: a veces hay otra ficha del mismo con los datos
        bien.
      </p>
    </Panel>
  );
}

function Result({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col gap-3">{children}</ul>;
}

function Found({ date, food }: { date: LocalDate; food: Food }) {
  return (
    <Result>
      <FoodCard food={food} action={<AddToDiaryLink date={date} food={food} />} />
    </Result>
  );
}

/**
 * El borrador se completa aquí mismo, en el hueco de la tarjeta.
 *
 * No hace falta otra pantalla: ya estamos en la dirección del producto, el
 * borrador está delante, y mandar a un tercer sitio para teclear cuatro números
 * solo añadiría una vuelta y un estado más que llevar de una pantalla a otra.
 */
function FoundDraft({ date, draft }: { date: LocalDate; draft: FoodDraft }) {
  return (
    <Result>
      <DraftCard draft={draft} action={<DraftCompletionForm date={date} draft={draft} />} />
    </Result>
  );
}
