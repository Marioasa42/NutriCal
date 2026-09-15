import { describe, expect, it } from 'vitest';

import {
  createCustomFood,
  updateCustomFood,
  type CustomFoodInput,
} from '@/domain/food/create-custom-food';
import type { Food } from '@/domain/food/food';
import { anInstant } from '@/test/factories';

const context = {
  now: () => anInstant('2026-09-15T10:00:00.000Z'),
  newFoodId: () => 'a0000000-0000-4000-8000-000000000001' as Food['id'],
};

function anInput(overrides: Partial<CustomFoodInput> = {}): CustomFoodInput {
  return {
    name: 'Tortilla de patatas casera',
    baseUnit: 'g',
    referenceAmount: 100,
    macros: { energy: 200, protein: 6, carbohydrates: 15, fat: 12 },
    micros: {},
    ...overrides,
  };
}

describe('createCustomFood', () => {
  it('crea un alimento con las cuatro macros obligatorias, marcadas como propias', () => {
    const result = createCustomFood(anInput(), context);

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;

    expect(result.food.name).toBe('Tortilla de patatas casera');
    expect(result.food.source).toEqual({ kind: 'custom' });
    expect(result.food.per100.macros.energy).toBe(200);
    expect(result.food.per100.macros.protein).toBe(6);
    expect(result.food.completion.userFilled).toEqual([
      'energy',
      'protein',
      'carbohydrates',
      'fat',
    ]);
    expect(result.food.servings).toEqual([]);
  });

  it('incluye las macros opcionales que se rellenan, marcadas igual que las obligatorias', () => {
    const result = createCustomFood(
      anInput({ macros: { energy: 200, protein: 6, carbohydrates: 15, fat: 12, fiber: 3 } }),
      context,
    );

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.food.per100.macros.fiber).toBe(3);
    expect(result.food.completion.userFilled).toContain('fiber');
  });

  it('escala a "por 100" cuando la cantidad de referencia no es 100', () => {
    // Una ración casera de 250 g con 500 kcal es, por 100 g, 200 kcal.
    const result = createCustomFood(
      anInput({
        referenceAmount: 250,
        macros: { energy: 500, protein: 15, carbohydrates: 37.5, fat: 30 },
      }),
      context,
    );

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.food.per100.macros.energy).toBe(200);
    expect(result.food.per100.macros.protein).toBe(6);
  });

  it('escala también los micronutrientes opcionales', () => {
    const result = createCustomFood(
      anInput({ referenceAmount: 200, micros: { iron: 2, vitaminC: 20 } }),
      context,
    );

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    // 2 mg de hierro en 200 g son 1 mg por 100 g.
    expect(result.food.per100.micros.iron).toBe(1);
    expect(result.food.per100.micros.vitaminC).toBe(10);
  });

  it('pide las macros que falten sin construir nada', () => {
    const result = createCustomFood(anInput({ macros: { energy: 200, protein: 6 } }), context);

    expect(result).toEqual({
      kind: 'missingMacros',
      missing: ['carbohydrates', 'fat'],
    });
  });

  it('rechaza una macro con un valor negativo', () => {
    const result = createCustomFood(
      anInput({ macros: { energy: 200, protein: -1, carbohydrates: 15, fat: 12 } }),
      context,
    );

    expect(result).toEqual({ kind: 'invalidMacroValue', key: 'protein', value: -1 });
  });

  it('rechaza un micronutriente con un valor negativo', () => {
    const result = createCustomFood(anInput({ micros: { iron: -5 } }), context);

    expect(result).toEqual({ kind: 'invalidMicroValue', key: 'iron', value: -5 });
  });

  it('rechaza una cantidad de referencia que no sea positiva', () => {
    expect(createCustomFood(anInput({ referenceAmount: 0 }), context)).toEqual({
      kind: 'invalidReferenceAmount',
    });
    expect(createCustomFood(anInput({ referenceAmount: -10 }), context)).toEqual({
      kind: 'invalidReferenceAmount',
    });
    expect(createCustomFood(anInput({ referenceAmount: Number.NaN }), context)).toEqual({
      kind: 'invalidReferenceAmount',
    });
  });

  it('construye un alimento de volumen cuando la unidad base es ml', () => {
    const result = createCustomFood(anInput({ baseUnit: 'ml' }), context);

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.food.baseUnit).toBe('ml');
  });
});

describe('updateCustomFood', () => {
  it('conserva el id y la fecha de creación, y renueva updatedAt', () => {
    const created = createCustomFood(anInput(), context);
    if (created.kind !== 'created') throw new Error('se esperaba "created"');

    const updated = updateCustomFood(
      created.food,
      anInput({ name: 'Tortilla de patatas, receta arreglada' }),
      { now: () => anInstant('2026-09-16T08:00:00.000Z'), newFoodId: context.newFoodId },
    );

    expect(updated.kind).toBe('created');
    if (updated.kind !== 'created') return;
    expect(updated.food.id).toBe(created.food.id);
    expect(updated.food.createdAt).toBe(created.food.createdAt);
    expect(updated.food.updatedAt).toBe('2026-09-16T08:00:00.000Z');
    expect(updated.food.name).toBe('Tortilla de patatas, receta arreglada');
  });

  it('sigue validando igual que al crear', () => {
    const created = createCustomFood(anInput(), context);
    if (created.kind !== 'created') throw new Error('se esperaba "created"');

    const updated = updateCustomFood(created.food, anInput({ referenceAmount: 0 }), context);
    expect(updated).toEqual({ kind: 'invalidReferenceAmount' });
  });
});
