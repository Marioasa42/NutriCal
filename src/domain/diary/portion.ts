import type { PortionSelection, ResolvedPortion } from '@/domain/diary/meal-entry';
import type { ServingOption } from '@/domain/food/food';
import type { ServingId } from '@/domain/identity/ids';
import { scale, type Quantity } from '@/domain/units/units';

/**
 * Lo que puede salir de resolver una porción, como unión discriminada.
 *
 * No lanza. El motivo no es el dato corrupto teórico: es que en la fase 3 se
 * importan archivos JSON, que son entrada externa y pueden traer un `servingId`
 * que no existe en la instantánea o un número de raciones que no es un número.
 * Con una excepción, un archivo mal formado tumbaría la pantalla del día entera;
 * con una unión, el registro problemático se muestra como tal y los demás del
 * día siguen viéndose. Es el mismo aislamiento por elemento que D-019 aplica a
 * los productos de una página de búsqueda. Ver D-025.
 */
export type PortionResolution<Q extends Quantity> =
  | { readonly kind: 'resolved'; readonly portion: ResolvedPortion<Q> }
  | { readonly kind: 'unknownServing'; readonly servingId: ServingId }
  | { readonly kind: 'invalidCount'; readonly count: number };

/**
 * Convierte lo que eligió la persona usuaria en su equivalencia en unidades base.
 *
 * Es genérica en la cantidad para que la porción salga en la misma unidad que
 * las opciones de servir que recibe: si le pasas las porciones de un alimento en
 * mililitros, el resultado son mililitros. Eso es lo que impide que un alimento
 * y su porción acaben en unidades distintas (D-005).
 *
 * Se comprueba `count` pero no `amount`, y la asimetría es deliberada: `count`
 * es un `number` pelado, que nadie ha validado nunca, mientras que `amount` ya
 * es una magnitud con marca y por tanto pasó por su constructor, que rechaza lo
 * negativo y lo no finito. Validar aquí lo que ya está validado sería desconfiar
 * del propio sistema de tipos; validar lo que nunca lo estuvo es lo que toca.
 */
export function resolvePortion<Q extends Quantity>(
  servings: readonly ServingOption<Q>[],
  selection: PortionSelection<Q>,
): PortionResolution<Q> {
  if (selection.kind === 'baseUnit') {
    return { kind: 'resolved', portion: { selection, amountInBaseUnit: selection.amount } };
  }

  // Cero raciones no es una porción que se pueda servir, el mismo criterio que
  // usa la normalización al descartar un `serving_quantity` de cero.
  if (!Number.isFinite(selection.count) || selection.count <= 0) {
    return { kind: 'invalidCount', count: selection.count };
  }

  const serving = servings.find((option) => option.id === selection.servingId);
  if (serving === undefined) {
    return { kind: 'unknownServing', servingId: selection.servingId };
  }

  return {
    kind: 'resolved',
    portion: {
      selection,
      // `scale` conserva la marca: media ración de un alimento en gramos sigue
      // siendo `Grams`, y no se redondea (D-023).
      amountInBaseUnit: scale(serving.amountInBaseUnit, selection.count),
    },
  };
}
