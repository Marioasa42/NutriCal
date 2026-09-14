import { Link } from 'react-router';

import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import type { LocalDate } from '@/domain/time/local-date';

/**
 * Qué se puede hacer con un resultado.
 *
 * Las dos acciones son enlaces, y eso no es casualidad ni pereza: el alimento ya
 * está guardado en el catálogo local cuando la tarjeta se dibuja (D-013), así
 * que para registrarlo basta con ir a una dirección que lleve su identificador.
 * Con un botón que primero escribiera y luego navegara, esta funcionalidad
 * tendría que importar código de la del diario, y la dirección de las
 * dependencias de D-027 dice que eso no puede ser.
 */

/** Llevar un alimento completo al formulario de registro. */
export function AddToDiaryLink({ date, food }: { date: LocalDate; food: Food }) {
  return (
    <Link
      to={`/dia/${date}/registrar/${food.id}`}
      className="inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
    >
      Añadir al diario
    </Link>
  );
}

/**
 * Llevar un borrador a la pantalla donde se completa.
 *
 * Esa pantalla es la del código de barras, que ya sabe resolver el producto y
 * ahora también sabe pedir lo que falta. Se navega con el código y no con el
 * borrador entero por lo mismo de siempre: una dirección se puede recargar y
 * compartir, y el borrador que hay en memoria no.
 *
 * Un borrador sin código de barras no puede llevar a ninguna parte. Hoy no
 * existe, porque la normalización descarta los productos que no traen código
 * (`unreadable`), pero el tipo lo permite y un hueco mudo parecería un fallo de
 * la aplicación, así que se dice.
 */
export function CompleteDraftLink({ date, draft }: { date: LocalDate; draft: FoodDraft }) {
  if (draft.source.kind !== 'openFoodFacts') {
    return (
      <p className="text-sm text-slate-500">
        Este resultado no trae código de barras, así que todavía no se puede completar.
      </p>
    );
  }

  return (
    <Link
      to={`/dia/${date}/codigo/${draft.source.barcode}`}
      className="inline-block rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
    >
      Completar y añadir
    </Link>
  );
}
