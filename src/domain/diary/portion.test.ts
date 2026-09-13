import { describe, expect, it } from 'vitest';

import { resolvePortion, type PortionResolution } from '@/domain/diary/portion';
import type { ServingOption } from '@/domain/food/food';
import type { ServingId } from '@/domain/identity/ids';
import { grams, milliliters, type Grams, type Milliliters } from '@/domain/units/units';

/**
 * Tests de la resolución de porciones.
 *
 * La marca de los identificadores se pone con `as` solo aquí, igual que en los
 * tests de normalización: lo que importa es que sean predecibles.
 */
const UNIDAD_MEDIANA = 'serving-manzana' as ServingId;
const LATA = 'serving-lata' as ServingId;

const porcionesEnGramos: readonly ServingOption<Grams>[] = [
  { id: UNIDAD_MEDIANA, label: '1 unidad mediana', amountInBaseUnit: grams(182) },
];

const porcionesEnMililitros: readonly ServingOption<Milliliters>[] = [
  { id: LATA, label: '1 lata', amountInBaseUnit: milliliters(330) },
];

/** Estrecha a la rama resuelta y falla con un mensaje claro si no lo es. */
function expectResolved<Q extends Grams | Milliliters>(result: PortionResolution<Q>): Q {
  if (result.kind !== 'resolved') {
    throw new Error(`Se esperaba una porción resuelta y llegó "${result.kind}".`);
  }
  return result.portion.amountInBaseUnit;
}

describe('porción elegida en unidades base', () => {
  it('pasa la cantidad tal cual', () => {
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'baseUnit',
      amount: grams(150),
    });
    expect(expectResolved(result)).toBe(150);
  });

  it('conserva la elección original para poder reeditarla', () => {
    // Se guardan las dos cosas: lo que la persona eligió y su equivalencia.
    const result = resolvePortion(porcionesEnGramos, { kind: 'baseUnit', amount: grams(150) });
    expect(result).toEqual({
      kind: 'resolved',
      portion: {
        selection: { kind: 'baseUnit', amount: 150 },
        amountInBaseUnit: 150,
      },
    });
  });
});

describe('porción elegida por raciones', () => {
  it('multiplica la ración por el número de veces', () => {
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'serving',
      servingId: UNIDAD_MEDIANA,
      count: 2,
    });
    expect(expectResolved(result)).toBe(364);
  });

  it('media ración no se redondea', () => {
    // El caso real: media manzana. 91 sale exacto, pero lo que se comprueba es
    // que nadie ha metido un `Math.round` por el camino.
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'serving',
      servingId: UNIDAD_MEDIANA,
      count: 0.5,
    });
    expect(expectResolved(result)).toBe(91);
  });

  it('una ración y media conserva el medio gramo', () => {
    // 182 × 1,5 = 273, entero. Donde el decimal sí aparece es en tres cuartos de
    // lata: 330 × 0,75 = 247,5, y ese medio mililitro tiene que llegar entero.
    expect(
      expectResolved(
        resolvePortion(porcionesEnGramos, {
          kind: 'serving',
          servingId: UNIDAD_MEDIANA,
          count: 1.5,
        }),
      ),
    ).toBe(273);

    expect(
      expectResolved(
        resolvePortion(porcionesEnMililitros, {
          kind: 'serving',
          servingId: LATA,
          count: 0.75,
        }),
      ),
    ).toBe(247.5);
  });

  it('un tercio de ración conserva los decimales que salgan', () => {
    // 182 / 3 no es un número redondo, que es justo lo que se quiere aquí: si
    // alguien colara un `Math.round`, este es el test que lo pillaría.
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'serving',
      servingId: UNIDAD_MEDIANA,
      count: 1 / 3,
    });
    expect(expectResolved(result)).toBeCloseTo(60.6667, 4);
    expect(Number.isInteger(expectResolved(result))).toBe(false);
  });

  it('resuelve en la unidad del alimento, no en gramos por defecto', () => {
    const result = resolvePortion(porcionesEnMililitros, {
      kind: 'serving',
      servingId: LATA,
      count: 1,
    });
    expect(expectResolved(result)).toBe(330);
  });
});

describe('porciones que no se pueden resolver', () => {
  it('devuelve la rama de ración desconocida en vez de lanzar', () => {
    // El caso de la fase 3: un archivo JSON importado con un `servingId` que no
    // existe en la instantánea. Tumbar la pantalla del día entera por un
    // registro sería la peor respuesta posible.
    const fantasma = 'serving-que-no-existe' as ServingId;
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'serving',
      servingId: fantasma,
      count: 1,
    });
    expect(result).toEqual({ kind: 'unknownServing', servingId: fantasma });
  });

  it('rechaza un número de raciones que no se puede servir', () => {
    for (const count of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolvePortion(porcionesEnGramos, {
        kind: 'serving',
        servingId: UNIDAD_MEDIANA,
        count,
      });
      expect(result.kind).toBe('invalidCount');
    }
  });

  it('comprueba el número de raciones antes de buscar la ración', () => {
    // Con las dos cosas mal, informa de la que puede arreglar quien llama: el
    // número. Es una elección, pero tiene que ser estable, así que se fija.
    const result = resolvePortion(porcionesEnGramos, {
      kind: 'serving',
      servingId: 'serving-que-no-existe' as ServingId,
      count: -1,
    });
    expect(result).toEqual({ kind: 'invalidCount', count: -1 });
  });
});
