import { describe, expect, it } from 'vitest';

import { choiceOf, createMealEntry, reviseMealEntry } from '@/domain/diary/log-meal';
import type { MealEntry } from '@/domain/diary/meal-entry';
import { entryTotals } from '@/domain/diary/totals';
import type { MealEntryId, ServingId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import { grams, kilocalories } from '@/domain/units/units';
import { aDate, makeFood } from '@/test/factories';

/**
 * Editar un registro no vuelve a consultar la fuente. Lo que estos tests
 * defienden es esa frase: corregir una cantidad no puede cambiar de paso las
 * calorías porque Open Food Facts haya tocado su ficha entre medias (D-003).
 */

const CREATED_AT = instant('2026-09-14T08:00:00.000Z');
const REVISED_AT = instant('2026-09-14T21:30:00.000Z');

const anEntry = (): MealEntry => {
  const result = createMealEntry(
    {
      food: makeFood({ energyKcal: 52 }),
      date: aDate(),
      slot: 'breakfast',
      choice: { kind: 'baseUnit', amount: 150 },
    },
    { now: () => CREATED_AT, newMealEntryId: () => 'entry-fijo' as MealEntryId },
  );
  if (result.kind !== 'created') throw new Error('se esperaba un registro');
  return result.entry;
};

const clock = { now: () => REVISED_AT };

describe('reviseMealEntry', () => {
  it('conserva la instantánea intacta', () => {
    const original = anEntry();
    const revised = reviseMealEntry(original, {
      slot: 'dinner',
      choice: { kind: 'baseUnit', amount: 200 },
    });
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    // La misma copia, campo por campo: el perfil, el origen y las marcas de
    // quién rellenó qué. Editar la cantidad edita la cantidad.
    expect(revised.entry.food).toEqual(original.food);
  });

  it('cambia la porción y el momento, y nada más de la identidad', () => {
    const original = anEntry();
    const revised = reviseMealEntry(
      original,
      { slot: 'dinner', choice: { kind: 'baseUnit', amount: 200 } },
      clock,
    );
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    expect(revised.entry.id).toBe(original.id);
    expect(revised.entry.date).toBe(original.date);
    expect(revised.entry.createdAt).toBe(CREATED_AT);
    expect(revised.entry.slot).toBe('dinner');
    expect(revised.entry.portion.amountInBaseUnit).toBe(grams(200));
  });

  it('mueve updatedAt, que es lo que ordenará los cambios al sincronizar', () => {
    const revised = reviseMealEntry(
      anEntry(),
      { slot: 'lunch', choice: { kind: 'baseUnit', amount: 120 } },
      clock,
    );
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    expect(revised.entry.updatedAt).toBe(REVISED_AT);
    expect(revised.entry.updatedAt).not.toBe(revised.entry.createdAt);
  });

  it('recalcula los totales con el perfil guardado, no con uno nuevo', () => {
    const revised = reviseMealEntry(
      anEntry(),
      { slot: 'breakfast', choice: { kind: 'baseUnit', amount: 200 } },
      clock,
    );
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    // 52 kcal por 100 g, el doble para 200 g. El perfil sale de la instantánea.
    expect(entryTotals(revised.entry).macros.energy).toBe(kilocalories(104));
  });

  it('sigue aceptando raciones de la instantánea', () => {
    const original = anEntry();
    const serving = original.food.servings[0];
    if (serving === undefined) throw new Error('la instantánea debe traer una porción');

    const revised = reviseMealEntry(
      original,
      { slot: 'snack', choice: { kind: 'serving', servingId: serving.id, count: 2 } },
      clock,
    );
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    expect(revised.entry.portion.amountInBaseUnit).toBe(grams(364));
  });

  it('rechaza lo imposible por las mismas ramas que al crear', () => {
    const original = anEntry();

    expect(
      reviseMealEntry(original, { slot: 'lunch', choice: { kind: 'baseUnit', amount: 0 } }, clock),
    ).toEqual({ kind: 'invalidAmount', amount: 0 });

    expect(
      reviseMealEntry(
        original,
        {
          slot: 'lunch',
          choice: { kind: 'serving', servingId: 'no-existe' as ServingId, count: 1 },
        },
        clock,
      ),
    ).toEqual({ kind: 'unknownServing', servingId: 'no-existe' });
  });
});

describe('choiceOf', () => {
  it('devuelve la elección tal y como se hizo, no su equivalencia', () => {
    const original = anEntry();
    const serving = original.food.servings[0];
    if (serving === undefined) throw new Error('la instantánea debe traer una porción');

    const revised = reviseMealEntry(
      original,
      { slot: 'snack', choice: { kind: 'serving', servingId: serving.id, count: 0.5 } },
      clock,
    );
    if (revised.kind !== 'created') throw new Error('se esperaba un registro');

    // Al reabrir el formulario tiene que verse "media ración", no "91 g": si
    // solo guardáramos los gramos, la persona perdería su forma de contar.
    expect(choiceOf(revised.entry)).toEqual({
      kind: 'serving',
      servingId: serving.id,
      count: 0.5,
    });
  });

  it('y la cantidad pelada cuando se registró así', () => {
    expect(choiceOf(anEntry())).toEqual({ kind: 'baseUnit', amount: grams(150) });
  });
});
