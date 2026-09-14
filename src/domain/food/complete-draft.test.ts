import { describe, expect, it } from 'vitest';

import {
  completeDraft,
  type CompleteDraftContext,
  type FilledMacros,
} from '@/domain/food/complete-draft';
import type { FoodDraft } from '@/domain/food/draft';
import { isUserFilled } from '@/domain/food/food';
import { newServingId, type FoodId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import { grams, kilocalories, milliliters } from '@/domain/units/units';

/**
 * Completar un borrador es la segunda mitad de D-002. Lo que estos tests
 * vigilan no es que los huecos se rellenen, que es lo fácil, sino que quede
 * constancia de qué cifra puso la persona usuaria: sin `userFilled`, una
 * estimación se vuelve indistinguible de un dato de la fuente en cuanto pasa un
 * mes.
 */

const COMPLETED_AT = instant('2026-09-14T09:00:00.000Z');

const fixedContext: CompleteDraftContext = {
  now: () => COMPLETED_AT,
  newFoodId: () => 'food-fijo' as FoodId,
};

const aDraft = (overrides: Partial<FoodDraft> = {}): FoodDraft => ({
  name: 'Pan de centeno',
  brand: 'Panadería local',
  source: { kind: 'openFoodFacts', barcode: '8410128750121', fetchedAt: COMPLETED_AT },
  baseUnit: 'g',
  macros: { energy: kilocalories(259), carbohydrates: grams(48.3) },
  micros: {},
  servings: [{ id: newServingId(), label: 'Una rebanada', amountInBaseUnit: grams(35) }],
  missing: ['protein', 'fat'],
  ...overrides,
});

describe('completeDraft', () => {
  it('marca como rellenado a mano exactamente lo que faltaba', () => {
    const filled: FilledMacros = { protein: 8.5, fat: 3.3 };
    const result = completeDraft(aDraft(), filled, fixedContext);
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    expect(result.food.completion.userFilled).toEqual(['protein', 'fat']);
    expect(result.food.completion.completedAt).toBe(COMPLETED_AT);

    // Lo que sí venía de la fuente no puede quedar marcado como estimación.
    expect(isUserFilled(result.food, 'protein')).toBe(true);
    expect(isUserFilled(result.food, 'energy')).toBe(false);
    expect(isUserFilled(result.food, 'carbohydrates')).toBe(false);
  });

  it('pone la unidad que corresponde a cada macro', () => {
    const result = completeDraft(
      aDraft({
        missing: ['energy', 'protein'],
        macros: { carbohydrates: grams(48.3), fat: grams(3.3) },
      }),
      { energy: 259, protein: 8.5 },
      fixedContext,
    );
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    // El formulario manda dos números pelados. Que uno sean kilocalorías y el
    // otro gramos lo decide esta capa, no quien teclea.
    expect(result.food.per100.macros.energy).toBe(kilocalories(259));
    expect(result.food.per100.macros.protein).toBe(grams(8.5));
  });

  it('conserva lo que sí traía la fuente', () => {
    const result = completeDraft(aDraft(), { protein: 8.5, fat: 3.3 }, fixedContext);
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    expect(result.food.per100.macros.carbohydrates).toBe(grams(48.3));
    expect(result.food.name).toBe('Pan de centeno');
    expect(result.food.brand).toBe('Panadería local');
    expect(result.food.source).toEqual(aDraft().source);
  });

  it('acepta el cero, que es una medida y no un hueco', () => {
    // El agua tiene cero calorías de verdad. Rechazar el cero obligaría a
    // teclear una mentira para poder guardar.
    const result = completeDraft(aDraft(), { protein: 0, fat: 0 }, fixedContext);
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    expect(result.food.per100.macros.protein).toBe(grams(0));
    expect(result.food.completion.userFilled).toContain('protein');
  });

  it('dice qué sigue faltando en vez de construir un alimento a medias', () => {
    const result = completeDraft(aDraft(), { protein: 8.5 }, fixedContext);
    expect(result).toEqual({ kind: 'stillMissing', missing: ['fat'] });
  });

  it('rechaza un valor imposible sin lanzar', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = completeDraft(aDraft(), { protein: value, fat: 3.3 }, fixedContext);
      expect(result, String(value)).toEqual({ kind: 'invalidValue', key: 'protein', value });
    }
  });

  it('rehace las porciones en la unidad base del alimento', () => {
    const serving = { id: newServingId(), label: 'Un vaso', amountInBaseUnit: milliliters(250) };
    const result = completeDraft(
      aDraft({ baseUnit: 'ml', servings: [serving], missing: ['protein', 'fat'] }),
      { protein: 3.1, fat: 3.6 },
      fixedContext,
    );
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    // Un borrador todavía no se ha comprometido con una unidad, así que sus
    // porciones son la unión de las dos. El alimento sí, y sus porciones tienen
    // que salir con la marca que le toca, no con una aserción de tipo.
    expect(result.food.baseUnit).toBe('ml');
    expect(result.food.servings[0]?.amountInBaseUnit).toBe(milliliters(250));
    expect(result.food.servings[0]?.id).toBe(serving.id);
  });

  it('nace vivo, con identificador propio y las dos marcas de tiempo iguales', () => {
    const result = completeDraft(aDraft(), { protein: 8.5, fat: 3.3 }, fixedContext);
    if (result.kind !== 'completed') throw new Error('se esperaba un alimento completo');

    expect(result.food.id).toBe('food-fijo');
    expect(result.food.deletedAt).toBeUndefined();
    expect(result.food.createdAt).toBe(COMPLETED_AT);
    expect(result.food.updatedAt).toBe(COMPLETED_AT);
  });
});
